
import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment } from '../../types';

interface CandidateOptions {
    desperate?: boolean;
    restrictRole?: number;
    excludeRole?: number;
    restrictSpecialty?: string;
}

export class Scheduler {
  private staff: Staff[];
  private staffMap: Map<string, Staff>; // Optimization: O(1) Lookup
  private services: Service[];
  private config: SchedulerConfig;
  private daysInMonth: number;
  private logs: string[] = [];
  
  // Cache
  private roommatesMap: Map<string, string[]> = new Map(); 

  constructor(staff: Staff[], services: Service[], config: SchedulerConfig) {
    this.staff = staff.filter(s => s.isActive !== false);
    this.staffMap = new Map(this.staff.map(s => [s.id, s])); // Initialize Map
    this.services = services;
    
    this.config = {
        ...config,
        unitConstraints: config.unitConstraints || []
    };
    
    this.daysInMonth = new Date(config.year, config.month + 1, 0).getDate();
    
    this.analyzeRoommates();
  }

  private analyzeRoommates() {
      const roomGroups = new Map<string, string[]>();
      this.staff.forEach(s => {
          if (!s.room || s.room.trim() === '') return;
          if (!roomGroups.has(s.room)) roomGroups.set(s.room, []);
          roomGroups.get(s.room)!.push(s.id);
      });

      this.staff.forEach(s => {
          if (s.room && s.room.trim() !== '') {
              const roommates = roomGroups.get(s.room)!.filter(id => id !== s.id);
              this.roommatesMap.set(s.id, roommates);
          } else {
              this.roommatesMap.set(s.id, []);
          }
      });
  }

  private isWeekend(day: number): boolean {
    const date = new Date(this.config.year, this.config.month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; 
  }

  private getDayOfWeek(day: number): number {
    return new Date(this.config.year, this.config.month, day).getDay(); 
  }

  private log(message: string) {
    if (this.logs.length < 1000) this.logs.push(message);
  }

  private getDayDifficulty(day: number): number {
      const dow = this.getDayOfWeek(day);
      const constraints = this.config.unitConstraints!.filter(c => c.allowedDays.includes(dow));
      if (dow === 6) return 80;  
      if (dow === 0) return 60;  
      return 10; 
  }

  private getServiceDifficulty(service: Service): number {
      let score = 1000;
      if (service.allowedUnits && service.allowedUnits.length > 0) {
          const eligible = this.staff.filter(s => service.allowedUnits?.includes(s.unit || '')).length;
          score -= (eligible * 10);
      }
      return score;
  }
  
  private getPotentialCandidatesCount(service: Service): number {
      return this.staff.filter(s => {
          if (service.allowedUnits && service.allowedUnits.length > 0) {
              if (!service.allowedUnits.includes(s.unit || '')) return false;
          }
          return true;
      }).length;
  }

  public generate(): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let minUnfilled = Infinity;
    let bestDeviation = Infinity;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      this.logs = []; 
      const currentResult = this.runSimulation(attempt);
      
      // Optimization: Lookup from Map
      const totalDeviation = currentResult.stats.reduce((acc, s) => {
        const staffDef = this.staffMap.get(s.staffId);
        if (!staffDef) return acc;
        return acc + Math.abs(staffDef.quotaService - s.totalShifts);
      }, 0);

      if (currentResult.unfilledSlots < minUnfilled) {
        minUnfilled = currentResult.unfilledSlots;
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      } else if (currentResult.unfilledSlots === minUnfilled && totalDeviation < bestDeviation) {
        bestDeviation = totalDeviation;
        bestResult = currentResult;
      }
    }

    if (!bestResult) throw new Error("Could not generate a schedule");
    return bestResult;
  }

  private hasShiftOnDay(assignmentsMap: Map<number, ShiftAssignment[]>, day: number, staffId: string): boolean {
    const assignments = assignmentsMap.get(day);
    if (!assignments) return false;
    // Optimization: Loop unrolling/check is fast enough here, Set overhead might be higher for small arrays
    for (let i = 0; i < assignments.length; i++) {
        if (assignments[i].staffId === staffId) return true;
    }
    return false;
  }

  private runSimulation(attemptIndex: number): ScheduleResult {
    const dayAssignmentsMap = new Map<number, ShiftAssignment[]>();
    for(let d=1; d<=this.daysInMonth; d++) dayAssignmentsMap.set(d, []);

    const staffStats = new Map<string, { total: number, service: number, emergency: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, service: 0, emergency: 0, weekend: 0, saturday: 0, sunday: 0 }));

    let unfilledSlots = 0;
    let daysToProcess = Array.from({length: this.daysInMonth}, (_, i) => i + 1);
    
    if (this.config.randomizeOrder) {
         daysToProcess.sort((a, b) => {
             const diff = this.getDayDifficulty(b) - this.getDayDifficulty(a);
             if (diff !== 0) return diff;
             return Math.random() - 0.5;
         });
    } else {
        daysToProcess.sort((a, b) => this.getDayDifficulty(b) - this.getDayDifficulty(a));
    }
    
    const assignToSlot = (day: number, candidate: Staff, service: Service) => {
        const currentDayAssignments = dayAssignmentsMap.get(day)!;
        const dayOfWeek = this.getDayOfWeek(day);
        const isWeekend = dayOfWeek === 6 || dayOfWeek === 0;
        const isSat = dayOfWeek === 6;
        const isSun = dayOfWeek === 0;

        currentDayAssignments.push({
            serviceId: service.id,
            staffId: candidate.id,
            staffName: candidate.name,
            role: candidate.role,
            group: candidate.group,
            unit: candidate.unit,
            isEmergency: service.isEmergency
        });
        
        const stats = staffStats.get(candidate.id)!;
        stats.total++;
        if (service.isEmergency) stats.emergency++; else stats.service++;
        if (isWeekend) stats.weekend++;
        if (isSat) stats.saturday++;
        if (isSun) stats.sunday++;
    };

    const getContext = (day: number) => {
        const dayOfWeek = this.getDayOfWeek(day);
        const assignments = dayAssignmentsMap.get(day)!;
        // Optimization: Use a temporary Set for fast lookups in this specific context
        const assignedTodayIds = new Set<string>();
        for (const a of assignments) assignedTodayIds.add(a.staffId);

        return {
            isWeekend: dayOfWeek === 6 || dayOfWeek === 0,
            isSat: dayOfWeek === 6,
            isSun: dayOfWeek === 0,
            isFri: dayOfWeek === 5,
            assignedTodayIds
        };
    };

    // --- PHASE 0 ---
    for (const day of daysToProcess) {
        const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
        const dayOfWeek = this.getDayOfWeek(day);
        const currentDayAssignments = dayAssignmentsMap.get(day)!;

        for (const constraint of this.config.unitConstraints || []) {
            if (constraint.allowedDays.includes(dayOfWeek)) {
                 const targetSpecialty = constraint.unit.trim();
                 // Optimize: Pre-filter this list outside loop if large, but usually small
                 const specialists = this.staff.filter(s => s.specialty && s.specialty.trim() === targetSpecialty);

                 if (specialists.length > 0) {
                     const alreadyAssigned = currentDayAssignments.some(a => {
                         const s = this.staffMap.get(a.staffId);
                         return s?.specialty?.trim() === targetSpecialty;
                     });

                     if (!alreadyAssigned) {
                         const eligibleServices = [...this.services]
                              .filter(s => s.minDailyCount > 0)
                              .sort((a, b) => {
                                  const aAllows = a.allowedUnits?.some(u => u.trim() === targetSpecialty) ? 1 : 0;
                                  const bAllows = b.allowedUnits?.some(u => u.trim() === targetSpecialty) ? 1 : 0;
                                  if (aAllows !== bAllows) return bAllows - aAllows;
                                  return this.getServiceDifficulty(b) - this.getServiceDifficulty(a)
                              });

                         for (const service of eligibleServices) {
                             const currentCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                             if (currentCount >= service.maxDailyCount) continue;

                             const specialistCandidate = this.findBestCandidate(
                                 service, day, assignedTodayIds, dayAssignmentsMap, staffStats,
                                 isWeekend, isSat, isSun, isFri,
                                 { restrictSpecialty: targetSpecialty }
                             );

                             if (specialistCandidate) {
                                 assignToSlot(day, specialistCandidate, service);
                                 assignedTodayIds.add(specialistCandidate.id);
                                 break;
                             }
                         }
                     }
                 }
            }
        }
    }

    // --- PHASE 1 ---
    for (const day of daysToProcess) {
        const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
        let seniorAssignedToday = false;
        // Fast Set Iteration
        for (const id of assignedTodayIds) {
            if (this.staffMap.get(id)?.role === 1) {
                seniorAssignedToday = true;
                break;
            }
        }

        if (!seniorAssignedToday) {
            const shuffledServicesForSenior = [...this.services].sort(() => Math.random() - 0.5);
            for (const service of shuffledServicesForSenior) {
                if (seniorAssignedToday) break;
                if (service.minDailyCount <= 0) continue;
                
                const currentDayAssignments = dayAssignmentsMap.get(day)!;
                const count = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                if (count >= service.minDailyCount) continue; 

                const seniorCandidate = this.findBestCandidate(
                    service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                    isWeekend, isSat, isSun, isFri, 
                    { restrictRole: 1 } 
                );

                if (seniorCandidate) {
                   assignToSlot(day, seniorCandidate, service);
                   seniorAssignedToday = true;
                }
            }
        }
    }

    // --- PHASE 2 ---
    const maxMinDailyCount = Math.max(...this.services.map(s => s.minDailyCount));

    for (let layer = 1; layer <= maxMinDailyCount; layer++) {
        for (const day of daysToProcess) {
            const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
            const currentDayAssignments = dayAssignmentsMap.get(day)!;
            const dailyServices = [...this.services].sort((a, b) => this.getServiceDifficulty(b) - this.getServiceDifficulty(a));

            for (const service of dailyServices) {
                let currentServiceCount = 0;
                // Fast count
                for(let i=0; i<currentDayAssignments.length; i++) {
                    if (currentDayAssignments[i].serviceId === service.id) currentServiceCount++;
                }
                
                while (currentServiceCount < layer && currentServiceCount < service.minDailyCount) {
                    
                    let bestCandidate = this.findBestCandidate(
                        service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                        isWeekend, isSat, isSun, isFri, {} 
                    );

                    if (!bestCandidate) {
                        bestCandidate = this.findBestCandidate(
                            service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                            isWeekend, isSat, isSun, isFri, { desperate: true }
                        );
                    }

                    if (bestCandidate) {
                        assignToSlot(day, bestCandidate, service);
                        assignedTodayIds.add(bestCandidate.id);
                        currentServiceCount++;
                    } else {
                        break; 
                    }
                }
            }
        }
    }

    // Final Minimum Check 
    for (const day of daysToProcess) {
        const currentDayAssignments = dayAssignmentsMap.get(day)!;
        for (const service of this.services) {
            let count = 0;
            for(let i=0; i<currentDayAssignments.length; i++) {
                if(currentDayAssignments[i].serviceId === service.id) count++;
            }

            if (count < service.minDailyCount) {
                for(let i=count; i<service.minDailyCount; i++) {
                    unfilledSlots++;
                     currentDayAssignments.push({
                        serviceId: service.id,
                        staffId: 'EMPTY',
                        staffName: `BOŞ (Min:${service.minDailyCount})`,
                        role: 0,
                        group: 'Genel',
                        unit: '-',
                        isEmergency: service.isEmergency
                     });
                }
            }
        }
    }

    // --- PHASE 3 ---
    if (this.config.dailyTotalTarget && this.config.dailyTotalTarget > 0) {
        for (const day of daysToProcess) {
             const { isWeekend, isSat, isSun, isFri, assignedTodayIds } = getContext(day);
             const currentDayAssignments = dayAssignmentsMap.get(day)!;
             let currentTotalStaff = 0;
             for(let i=0; i<currentDayAssignments.length; i++) {
                 if (currentDayAssignments[i].staffId !== 'EMPTY') currentTotalStaff++;
             }

             let protectionCounter = 0;
             while (currentTotalStaff < this.config.dailyTotalTarget && protectionCounter < 50) {
                  protectionCounter++;
                  const flexibleServices = this.services.filter(s => {
                      const currentCount = currentDayAssignments.filter(a => a.serviceId === s.id).length;
                      return currentCount < s.maxDailyCount;
                  });
                  
                  if (flexibleServices.length === 0) break;
                  
                  flexibleServices.sort((a, b) => this.getPotentialCandidatesCount(b) - this.getPotentialCandidatesCount(a));
                  
                  let filledSomething = false;
                  for (const service of flexibleServices) {
                       let extraCandidate = this.findBestCandidate(
                          service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                          isWeekend, isSat, isSun, isFri, {} 
                      );
                      
                      if (!extraCandidate) {
                          extraCandidate = this.findBestCandidate(
                              service, day, assignedTodayIds, dayAssignmentsMap, staffStats, 
                              isWeekend, isSat, isSun, isFri, { desperate: true }
                          );
                      }
    
                      if (extraCandidate) {
                          assignToSlot(day, extraCandidate, service);
                          assignedTodayIds.add(extraCandidate.id);
                          currentTotalStaff++;
                          filledSomething = true;
                          break; 
                      }
                  }
                  if (!filledSomething) break;
             }
        }
    }

    const schedule: DaySchedule[] = [];
    for(let d=1; d<=this.daysInMonth; d++) {
        schedule.push({
            day: d,
            assignments: dayAssignmentsMap.get(d) || [],
            isWeekend: this.isWeekend(d),
            isHoliday: false
        });
    }

    return {
      schedule,
      unfilledSlots,
      logs: this.logs,
      stats: Array.from(staffStats.entries()).map(([id, s]) => ({
        staffId: id,
        totalShifts: s.total,
        serviceShifts: s.service,
        emergencyShifts: s.emergency,
        weekendShifts: s.weekend,
        saturdayShifts: s.saturday,
        sundayShifts: s.sunday
      }))
    };
  }

  private findBestCandidate(
      service: Service, 
      day: number, 
      assignedTodayIds: Set<string>, 
      dayAssignmentsMap: Map<number, ShiftAssignment[]>,
      staffStats: Map<string, any>,
      isWeekend: boolean, isSat: boolean, isSun: boolean, isFri: boolean,
      options: CandidateOptions
  ): Staff | null {
      
      const dayOfWeek = this.getDayOfWeek(day); 

      // 1. Min Shifts Logic (Optimize filter)
      let minJuniorShifts = 999;
      // Filter directly on the main array
      const activeJuniorsCount = this.staff.reduce((count, s) => (s.role === 3 && s.isActive ? count + 1 : count), 0);
      
      if (activeJuniorsCount > 0) {
          // Since we need values, we still map, but only iterate active ones
          const juniors = this.staff.filter(s => s.role === 3 && s.isActive);
          minJuniorShifts = Math.min(...juniors.map(j => staffStats.get(j.id)?.total || 0));
      }

      const minShiftsByRole: Record<number, number> = {};
      [1, 2, 3].forEach(r => {
          const referenceGroup = this.staff.filter(s => 
              s.role === r && s.isActive && (s.specialty === 'none' || !s.specialty) &&
              (staffStats.get(s.id)?.total || 0) < s.quotaService
          );

          if (referenceGroup.length > 0) {
              minShiftsByRole[r] = Math.min(...referenceGroup.map(p => staffStats.get(p.id)?.total || 0));
          } else {
              // Fallback to all in role if everyone finished
              const allInRole = this.staff.filter(s => s.role === r && s.isActive && (s.specialty === 'none' || !s.specialty));
              if(allInRole.length > 0) {
                  minShiftsByRole[r] = Math.min(...allInRole.map(p => staffStats.get(p.id)?.total || 0));
              } else {
                  minShiftsByRole[r] = 0;
              }
          }
      });
      
      let seniorCountOnDay = 0;
      for (const id of assignedTodayIds) {
          if (this.staffMap.get(id)?.role === 1) seniorCountOnDay++;
      }
      
      const assignedUnitsCount = new Map<string, number>();
      for (const id of assignedTodayIds) {
          const s = this.staffMap.get(id);
          if (s && s.unit) {
              assignedUnitsCount.set(s.unit, (assignedUnitsCount.get(s.unit) || 0) + 1);
          }
      }

      const assignedYesterdayUnitsCount = new Map<string, number>();
      const yesterdayAssignments = dayAssignmentsMap.get(day - 1);
      if (yesterdayAssignments) {
          for (const a of yesterdayAssignments) {
              const s = this.staffMap.get(a.staffId);
              if (s && s.unit) {
                  assignedYesterdayUnitsCount.set(s.unit, (assignedYesterdayUnitsCount.get(s.unit) || 0) + 1);
              }
          }
      }

      const candidates = this.staff.filter(person => {
          // --- OPTIONS FILTERS ---
          if (options.restrictRole !== undefined && person.role !== options.restrictRole) return false;
          if (options.excludeRole !== undefined && person.role === options.excludeRole) return false;
          if (options.restrictSpecialty && person.specialty?.trim() !== options.restrictSpecialty) return false;

          // --- HARD CONSTRAINTS ---
          if (assignedTodayIds.has(person.id)) return false;
          if (person.offDays.includes(day)) return false;

          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;
          
          // 4. Unit Matching
          const isNewNurse = person.role === 3;
          
          if (!isNewNurse) {
              if (service.allowedUnits && service.allowedUnits.length > 0) {
                  if (!service.allowedUnits.includes(person.unit || '')) return false;
              }

              const constraint = this.config.unitConstraints?.find(c => c.unit === person.unit);
              if (constraint) {
                  if (!constraint.allowedDays.includes(dayOfWeek)) return false;
              }
              
              if (person.specialty && person.specialty !== 'none') {
                  const specConstraint = this.config.unitConstraints?.find(c => c.unit.trim() === person.specialty?.trim());
                  if (specConstraint) {
                      if (!specConstraint.allowedDays.includes(dayOfWeek)) return false;
                  }
              }
          }

          // 5. ROOMMATE CONFLICTS
          const roommates = this.roommatesMap.get(person.id) || [];
          for (const roommateId of roommates) {
              if (assignedTodayIds.has(roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, roommateId)) return false;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, roommateId)) return false;

              const roommate = this.staffMap.get(roommateId);
              if (roommate && roommate.offDays.includes(day)) return false;
          }

          const stats = staffStats.get(person.id)!;
          if (stats.total >= person.quotaService) return false;
          if (isWeekend && stats.weekend >= person.weekendLimit) return false;

          if (isSat && this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) return false;
          if (isSun && this.hasShiftOnDay(dayAssignmentsMap, day - 3, person.id)) return false;
          if (dayOfWeek === 4) {
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) return false;
             if (this.hasShiftOnDay(dayAssignmentsMap, day + 3, person.id)) return false;
          }

          if (person.specialty === 'none' || !person.specialty) {
              if (stats.total > minShiftsByRole[person.role]) return false;
          }
          
          if (person.role === 1) {
              if (seniorCountOnDay >= 2) return false;
              if (!options.desperate && seniorCountOnDay >= 1) return false;
          }

          if (!options.desperate) {
              if (person.role === 2 && activeJuniorsCount > 0) {
                  if (stats.total >= minJuniorShifts) return false;
              }
          }
          
          return true;
        }).map(person => {
          const stats = staffStats.get(person.id)!;
          let score = 0;

          if (options.restrictSpecialty && person.specialty?.trim() === options.restrictSpecialty) score += 500000;

          if (person.specialty && person.specialty !== 'none') {
             const constraint = this.config.unitConstraints?.find(c => c.unit.trim() === person.specialty?.trim());
             if (constraint && constraint.allowedDays.includes(dayOfWeek)) score += 100000;
          }

          if (person.requestedDays && person.requestedDays.includes(day)) score += 20000;
          
          const countToday = assignedUnitsCount.get(person.unit || '') || 0;
          const countYesterday = assignedYesterdayUnitsCount.get(person.unit || '') || 0;
          
          if (countToday === 0) score += 10000;
          
          const isServiceRestrictedToUnit = service.allowedUnits?.includes(person.unit || '');
          if (countToday > 0 && !isServiceRestrictedToUnit) score -= 8000; 
          if (countYesterday > 0 && !isServiceRestrictedToUnit) score -= 3000; 
          
          if (countYesterday === 0 && countToday === 0) score += 2000;

          if (person.role === 3) score += 2000; 

          if (person.role === 1 && seniorCountOnDay >= 1) score -= 50000; 
          
          if (person.role === 1 && isSat) score -= 5000;

          const remaining = person.quotaService - stats.total;
          score += (remaining * 3000); 

          if (isWeekend) score -= (stats.weekend * 2000);

          if (this.config.preventEveryOtherDay) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score -= 1000;
          }

          score += Math.random() * 500;

          return { person, score };
        });

      candidates.sort((a, b) => b.score - a.score);

      return candidates.length > 0 ? candidates[0].person : null;
  }
}
