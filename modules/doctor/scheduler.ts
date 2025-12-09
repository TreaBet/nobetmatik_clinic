
import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment, Stats } from '../../types';

interface DayInfo {
    dayOfWeek: number;
    isWeekend: boolean;
    isHoliday: boolean;
}

export class Scheduler {
  private staff: Staff[];
  private staffMap: Map<string, Staff>; // O(1) Lookup
  private services: Service[];
  private sortedServices: Service[];
  private config: SchedulerConfig;
  private daysInMonth: number;
  private logs: string[] = [];
  
  private dayCache: DayInfo[];
  private previousMonthSchedule: DaySchedule[] | null;
  private staffFlexibilityScore: Map<string, number> = new Map();

  constructor(
      staff: Staff[], 
      services: Service[], 
      config: SchedulerConfig,
      previousMonthSchedule: DaySchedule[] | null = null
  ) {
    this.staff = staff.filter(s => s.isActive !== false); 
    this.staffMap = new Map(this.staff.map(s => [s.id, s]));

    this.services = services;
    this.config = config;
    this.previousMonthSchedule = previousMonthSchedule;
    this.daysInMonth = new Date(this.config.year, this.config.month + 1, 0).getDate();
    
    this.dayCache = new Array(this.daysInMonth + 1);
    for(let d = 1; d <= this.daysInMonth; d++) {
        const date = new Date(this.config.year, this.config.month, d);
        const dayOfWeek = date.getDay();
        this.dayCache[d] = {
            dayOfWeek: dayOfWeek,
            isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
            isHoliday: this.config.holidays.includes(d)
        };
    }

    this.calculateStaffFlexibility();

    this.sortedServices = [...this.services].sort((a, b) => {
        return this.getServiceDifficulty(b) - this.getServiceDifficulty(a);
    });
  }

  private log(message: string) {
    if (this.logs.length < 1000) { 
      this.logs.push(message);
    }
  }

  private calculateStaffFlexibility() {
      this.staff.forEach(person => {
          let count = 0;
          this.services.forEach(service => {
              if (service.allowedRoles.includes(person.role)) {
                  count++;
              }
          });
          this.staffFlexibilityScore.set(person.id, count);
      });
  }

  private getServiceDifficulty(service: Service): number {
    const eligibleCount = this.staff.filter(s => 
        service.allowedRoles.includes(s.role) && 
        s.offDays.length < 15 && 
        (service.preferredGroup === 'Farketmez' || !service.preferredGroup || s.group === service.preferredGroup)
    ).length;

    let score = 2000 - (eligibleCount * 20);
    score += (service.minDailyCount * 100);
    if (service.priorityRoles && service.priorityRoles.length > 0) {
        score += 50;
    }
    if (service.isEmergency) {
        score += 100;
    }

    return score;
  }

  public generate(): ScheduleResult {
    this.logs = []; 
    
    if (this.config.useGeneticAlgorithm) {
      this.log("MOD: Genetik Algoritma (Evolutionary Solver) Aktif.");
      this.log("Bilgi: Popülasyon oluşturuluyor ve evrimleştiriliyor...");
      return this.generateGenetic();
    } else {
      this.log("MOD: Monte Carlo Simülasyonu (Standart) Aktif.");
      if (this.previousMonthSchedule) {
          this.log("Bilgi: Önceki ay verisi tespit edildi. Köprü mantığı (Bridge) aktif.");
      }
      this.log(`Bilgi: ${this.config.maxRetries} deneme yapılacak.`);
      return this.generateMonteCarlo();
    }
  }

  private generateMonteCarlo(): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let minUnfilled = Infinity;
    let bestDeviation = Infinity;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      const tempLogs = (attempt === 0) ? [...this.logs] : []; 
      const currentResult = this.runSimulation();
      
      if (attempt === 0) currentResult.logs = tempLogs; 

      const deviation = this.calculateDeviation(currentResult);

      if (currentResult.unfilledSlots < minUnfilled) {
        minUnfilled = currentResult.unfilledSlots;
        bestDeviation = deviation;
        bestResult = currentResult;
      } 
      else if (currentResult.unfilledSlots === minUnfilled && deviation < bestDeviation) {
        bestDeviation = deviation;
        bestResult = currentResult;
      }
    }

    if (!bestResult) {
      throw new Error("Could not generate a schedule");
    }

    return bestResult;
  }

  private generateGenetic(): ScheduleResult {
    const POPULATION_SIZE = 50;
    const GENERATIONS = 20;
    const ELITISM_COUNT = 5;

    let population: ScheduleResult[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        const res = this.runSimulation();
        res.logs = [...this.logs];
        population.push(res);
    }

    for (let gen = 0; gen < GENERATIONS; gen++) {
        population.forEach(ind => {
            ind.fitness = (ind.unfilledSlots * 10000) + this.calculateDeviation(ind);
        });

        population.sort((a, b) => (a.fitness || 0) - (b.fitness || 0));

        if (population[0].fitness === 0) return population[0];

        const newPopulation = population.slice(0, ELITISM_COUNT);

        while (newPopulation.length < POPULATION_SIZE) {
            const parentA = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))]; 
            const parentB = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))];

            let child: ScheduleResult;

            if (Math.random() < 0.7) {
                child = this.crossover(parentA, parentB);
            } else {
                child = this.mutate(parentA);
            }
            
            child.logs = [...this.logs]; 
            newPopulation.push(child);
        }

        population = newPopulation;
    }

    population.sort((a, b) => (a.fitness || 0) - (b.fitness || 0));
    this.log(`Genetik Algoritma Tamamlandı. En iyi skor: ${population[0].fitness}`);
    return population[0];
  }

  private calculateDeviation(result: ScheduleResult): number {
    return result.stats.reduce((acc, s) => {
        const staffDef = this.staffMap.get(s.staffId);
        if (!staffDef) return acc;
        return acc + Math.abs(staffDef.quotaService - s.serviceShifts) + Math.abs(staffDef.quotaEmergency - s.emergencyShifts);
    }, 0);
  }

  private crossover(parentA: ScheduleResult, parentB: ScheduleResult): ScheduleResult {
     const splitDay = Math.floor(Math.random() * (this.daysInMonth - 2)) + 2; 
     const newSchedule: DaySchedule[] = [];
     
     // Deep copy with structuredClone
     for(let d=1; d<=splitDay; d++) {
         const day = parentA.schedule.find(s => s.day === d)!;
         newSchedule.push(structuredClone(day));
     }

     for(let d=splitDay+1; d<=this.daysInMonth; d++) {
         const day = parentB.schedule.find(s => s.day === d)!;
         newSchedule.push(structuredClone(day));
     }

     const dayBefore = newSchedule.find(s => s.day === splitDay);
     const dayAfter = newSchedule.find(s => s.day === splitDay + 1);

     if (dayBefore && dayAfter) {
         const workersBefore = new Set(dayBefore.assignments.map(a => a.staffId));
         dayAfter.assignments.forEach((assign, idx) => {
             if (assign.staffId !== 'EMPTY' && workersBefore.has(assign.staffId)) {
                 dayAfter.assignments[idx] = {
                     ...assign,
                     staffId: 'EMPTY',
                     staffName: 'BOŞ (Çakışma)',
                     role: 0
                 };
             }
         });
     }

     return this.recalculateStatsFromSchedule(newSchedule);
  }

  private mutate(parent: ScheduleResult): ScheduleResult {
     // Performance: structuredClone is faster than JSON parse/stringify
     const newSchedule = structuredClone(parent.schedule);
     
     const problemDays = newSchedule.filter((d: DaySchedule) => d.assignments.some(a => a.staffId === 'EMPTY')).map((d: DaySchedule) => d.day);
     
     if (problemDays.length === 0) {
         const r = Math.floor(Math.random() * this.daysInMonth) + 1;
         problemDays.push(r);
     }

     const mutationDayNum = problemDays[Math.floor(Math.random() * problemDays.length)];
     const dayObj = newSchedule.find((d: DaySchedule) => d.day === mutationDayNum);
     
     if (dayObj && dayObj.assignments.length >= 2) {
         const idx1 = Math.floor(Math.random() * dayObj.assignments.length);
         const idx2 = Math.floor(Math.random() * dayObj.assignments.length);
         
         if (idx1 !== idx2) {
             const a1 = dayObj.assignments[idx1];
             const a2 = dayObj.assignments[idx2];
             
             const s1Service = this.services.find(s => s.id === a1.serviceId);
             const s2Service = this.services.find(s => s.id === a2.serviceId);
             
             if (s1Service && s2Service && a1.staffId !== 'EMPTY' && a2.staffId !== 'EMPTY') {
                 const p1 = this.staffMap.get(a1.staffId);
                 const p2 = this.staffMap.get(a2.staffId);
                 
                 if (p1 && p2 && s1Service.allowedRoles.includes(p2.role) && s2Service.allowedRoles.includes(p1.role)) {
                     const tempId = a1.staffId; const tempName = a1.staffName; const tempRole = a1.role; const tempGroup = a1.group;
                     dayObj.assignments[idx1] = { ...a1, staffId: a2.staffId, staffName: a2.staffName, role: a2.role, group: a2.group };
                     dayObj.assignments[idx2] = { ...a2, staffId: tempId, staffName: tempName, role: tempRole, group: tempGroup };
                 }
             }
         }
     }

     return this.recalculateStatsFromSchedule(newSchedule);
  }

  private recalculateStatsFromSchedule(schedule: DaySchedule[]): ScheduleResult {
      const statsMap = new Map<string, Stats>();
      this.staff.forEach(s => {
          statsMap.set(s.id, {
              staffId: s.id,
              totalShifts: 0, serviceShifts: 0, emergencyShifts: 0, weekendShifts: 0, saturdayShifts: 0, sundayShifts: 0
          });
      });

      let unfilled = 0;

      schedule.forEach(day => {
          const dInfo = this.dayCache[day.day]; 
          const isWknd = dInfo.isWeekend;
          const isSat = dInfo.dayOfWeek === 6;
          const isSun = dInfo.dayOfWeek === 0;
          const isHol = dInfo.isHoliday;

          day.assignments.forEach(a => {
              if (a.staffId === 'EMPTY') {
                  unfilled++;
                  return;
              }
              const st = statsMap.get(a.staffId);
              if (st) {
                  st.totalShifts++;
                  if (a.isEmergency) st.emergencyShifts++; else st.serviceShifts++;
                  if (isWknd || isHol) st.weekendShifts++;
                  if (isSat) st.saturdayShifts++;
                  if (isSun) st.sundayShifts++;
              }
          });
      });

      return {
          schedule,
          unfilledSlots: unfilled,
          stats: Array.from(statsMap.values()),
          logs: []
      };
  }

  // --- CORE SIMULATION ---

  private hasShiftOnDay(assignmentsMap: Map<number, ShiftAssignment[]>, day: number, staffId: string): boolean {
    if (day > 0) {
        const assignments = assignmentsMap.get(day);
        if (!assignments) return false;
        for(let i=0; i<assignments.length; i++) {
            if (assignments[i].staffId === staffId) return true;
        }
        return false;
    }
    
    // Bridge Check
    if (this.previousMonthSchedule && this.previousMonthSchedule.length > 0) {
        const prevMonthLength = this.previousMonthSchedule.length;
        const targetDayNum = this.previousMonthSchedule[prevMonthLength + day - 1]?.day; 
        
        if (targetDayNum) {
            const prevDaySchedule = this.previousMonthSchedule.find(d => d.day === targetDayNum);
            return prevDaySchedule?.assignments.some(a => a.staffId === staffId) ?? false;
        }
    }
    
    return false;
  }

  private runSimulation(): ScheduleResult {
    const dayAssignmentsMap = new Map<number, ShiftAssignment[]>();
    for(let d=1; d<=this.daysInMonth; d++) {
        dayAssignmentsMap.set(d, []);
    }

    const staffStats = new Map<string, { total: number, service: number, emergency: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, service: 0, emergency: 0, weekend: 0, saturday: 0, sunday: 0 }));

    const staffStress = new Map<string, number>();
    this.staff.forEach(s => staffStress.set(s.id, 0));

    let unfilledSlots = 0;

    const maxLayer = Math.max(...this.services.map(s => s.maxDailyCount));
    const allDays = Array.from({length: this.daysInMonth}, (_, i) => i + 1);

    if (this.config.randomizeOrder) {
        for (let i = allDays.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allDays[i], allDays[j]] = [allDays[j], allDays[i]];
        }
    }

    for (let layer = 0; layer < maxLayer; layer++) {
        const sortedDays = [...allDays].sort((a, b) => {
            const infoA = this.dayCache[a];
            const infoB = this.dayCache[b];

            const getPriority = (d: number, isHol: boolean) => {
                 if (isHol) return 1100;
                 if (d === 6) return 1000;
                 if (d === 0) return 900;
                 if (d === 5) return 800;
                 if (d === 4) return 700;
                 return 0; 
            };

            return getPriority(infoB.dayOfWeek, infoB.isHoliday) - getPriority(infoA.dayOfWeek, infoA.isHoliday);
        });

        for (const day of sortedDays) {
             const dInfo = this.dayCache[day];
             const isWeekendReal = dInfo.isWeekend;
             const isHoliday = dInfo.isHoliday;
             const isWeekendOrHoliday = isWeekendReal || isHoliday;
             const isSat = dInfo.dayOfWeek === 6;
             const isSun = dInfo.dayOfWeek === 0;
             const isThu = dInfo.dayOfWeek === 4;

             const currentDayAssignments = dayAssignmentsMap.get(day)!;
             const assignedTodayIds = new Set<string>();
             // Optimization: Fast iteration
             for(const a of currentDayAssignments) assignedTodayIds.add(a.staffId);
             
             // Optimize Group Counting
             const dayGroupCounts: Record<string, number> = { 'A':0, 'B':0, 'C':0, 'D':0, 'Genel': 0 };
             currentDayAssignments.forEach(a => {
                 if (a.group) dayGroupCounts[a.group]++;
             });

             for (const service of this.sortedServices) {
                const mustFill = service.minDailyCount > layer;
                const canFill = service.maxDailyCount > layer;

                if (!canFill) continue;

                let currentCount = 0;
                for(let i=0; i<currentDayAssignments.length; i++) {
                    if (currentDayAssignments[i].serviceId === service.id) currentCount++;
                }

                if (currentCount > layer) continue;

                let bestCandidate = this.findBestCandidate(
                    service, day, assignedTodayIds, dayAssignmentsMap, staffStats, staffStress,
                    isWeekendOrHoliday, isSat, isSun, isThu, dayGroupCounts, false
                );

                if (!bestCandidate && mustFill) {
                    bestCandidate = this.findBestCandidate(
                        service, day, assignedTodayIds, dayAssignmentsMap, staffStats, staffStress,
                        isWeekendOrHoliday, isSat, isSun, isThu, dayGroupCounts, true
                    );
                }

                if (bestCandidate) {
                    currentDayAssignments.push({
                        serviceId: service.id,
                        staffId: bestCandidate.id,
                        staffName: bestCandidate.name,
                        role: bestCandidate.role,
                        group: bestCandidate.group,
                        isEmergency: service.isEmergency
                    });
                    assignedTodayIds.add(bestCandidate.id);
                    dayGroupCounts[bestCandidate.group]++;
                    
                    const stats = staffStats.get(bestCandidate.id)!;
                    stats.total++;
                    if (service.isEmergency) stats.emergency++; else stats.service++;
                    if (isWeekendOrHoliday) stats.weekend++;
                    if (isSat) stats.saturday++;
                    if (isSun) stats.sunday++;

                    if (this.config.useFatigueModel) {
                        const currentStress = staffStress.get(bestCandidate.id) || 0;
                        const addedStress = (service.isEmergency ? 15 : 10) * (isWeekendOrHoliday ? 1.5 : 1.0);
                        staffStress.set(bestCandidate.id, currentStress + addedStress);
                    }

                } else {
                    if (mustFill) {
                        unfilledSlots++;
                        currentDayAssignments.push({
                            serviceId: service.id,
                            staffId: 'EMPTY',
                            staffName: `BOŞ`,
                            role: 0,
                            group: 'Genel',
                            isEmergency: service.isEmergency
                        });
                    }
                }
             }
        }
    }

    const schedule: DaySchedule[] = [];
    for(let d=1; d<=this.daysInMonth; d++) {
        const info = this.dayCache[d];
        schedule.push({
            day: d,
            assignments: dayAssignmentsMap.get(d) || [],
            isWeekend: info.isWeekend,
            isHoliday: info.isHoliday
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
      staffStress: Map<string, number>,
      isWeekendOrHoliday: boolean, isSat: boolean, isSun: boolean, isThu: boolean,
      dayGroupCounts: Record<string, number>,
      desperateMode: boolean
  ): Staff | null {
      
      let bestPerson: Staff | null = null;
      let minScore = Infinity;

      for (const person of this.staff) {
          if (!service.allowedRoles.includes(person.role)) continue;
          if (assignedTodayIds.has(person.id)) continue;
          if (person.offDays.includes(day)) continue;
          
          if (service.preferredGroup && service.preferredGroup !== 'Farketmez') {
              if (person.group !== service.preferredGroup) continue;
          }

          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) continue;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) continue;

          const stats = staffStats.get(person.id)!;

          if (!desperateMode) {
              if (isWeekendOrHoliday) {
                  const prevThursday = isSat ? day - 2 : (isSun ? day - 3 : -1);
                  if (prevThursday > 0 && this.hasShiftOnDay(dayAssignmentsMap, prevThursday, person.id)) {
                      continue;
                  }
              }

              if (isThu) {
                  const nextSat = day + 2;
                  const nextSun = day + 3;
                  if (nextSat <= this.daysInMonth && this.hasShiftOnDay(dayAssignmentsMap, nextSat, person.id)) continue;
                  if (nextSun <= this.daysInMonth && this.hasShiftOnDay(dayAssignmentsMap, nextSun, person.id)) continue;
              }

              if (service.isEmergency) {
                if (stats.emergency >= person.quotaEmergency) continue;
              } else {
                if (stats.service >= person.quotaService) continue;
              }
              
              if (isWeekendOrHoliday && stats.weekend >= person.weekendLimit) continue;
              if (isSat && stats.saturday >= stats.sunday + 1) continue;
              if (isSun && stats.sunday >= stats.saturday + 1) continue;
          }

          let score = 0;

          if (service.priorityRoles && service.priorityRoles.includes(person.role)) score -= 20000;

          if (person.requestedDays && person.requestedDays.includes(day)) score -= 50000;

          const target = service.isEmergency ? person.quotaEmergency : person.quotaService;
          const current = service.isEmergency ? stats.emergency : stats.service;
          const remaining = target - current;
          score -= (remaining * 5000); 

          const personFlexibility = this.staffFlexibilityScore.get(person.id) || 1;
          const isGenericService = service.allowedRoles.length > 3; 
          if (personFlexibility <= 2 && !isGenericService) score -= 5000;
          if (personFlexibility > 4 && isGenericService && !desperateMode) score += 2000;

          if (this.config.preventEveryOtherDay && !desperateMode) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score += 4000;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) score += 4000;
          }

          const groupCount = dayGroupCounts[person.group] || 0;
          score += (groupCount * 2500);

          if (this.config.useFatigueModel) {
              const currentStress = staffStress.get(person.id) || 0;
              score += currentStress * 50; 
              if (!desperateMode && currentStress > 100) score += 100000; 
          }

          score += Math.random() * 200;

          if (score < minScore) {
              minScore = score;
              bestPerson = person;
          }
      }

      return bestPerson;
  }
}
