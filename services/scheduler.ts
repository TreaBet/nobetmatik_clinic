import { Staff, Service, DaySchedule, SchedulerConfig, ScheduleResult, ShiftAssignment, Stats } from '../types';

export class Scheduler {
  private staff: Staff[];
  private services: Service[];
  private config: SchedulerConfig;
  private daysInMonth: number;
  private logs: string[] = [];
  
  // Cache for optimization and logic
  private staffFlexibilityScore: Map<string, number> = new Map();

  constructor(staff: Staff[], services: Service[], config: SchedulerConfig) {
    // FILTER: Only include Active staff in the simulation
    this.staff = staff.filter(s => s.isActive !== false); 
    
    this.services = services;
    this.config = config;
    this.daysInMonth = new Date(config.year, config.month + 1, 0).getDate();
    
    // Pre-calculate logic
    this.calculateStaffFlexibility();
  }

  private isWeekend(day: number): boolean {
    const date = new Date(this.config.year, this.config.month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  }

  private getDayOfWeek(day: number): number {
    return new Date(this.config.year, this.config.month, day).getDay();
  }

  private log(message: string) {
    if (this.logs.length < 1000) { // Prevent infinite memory issues
      this.logs.push(message);
    }
  }

  /**
   * Calculates how "Flexible" each staff member is.
   * Low Score = Specialist (Can only do a few services) -> PROTECT THEM
   * High Score = Generalist (Can do many services) -> USE THEM FREELY
   */
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

  /**
   * Calculates a 'Difficulty Score' for a service.
   * Higher score = Harder to fill (Fewer eligible staff, high demand, etc.)
   */
  private getServiceDifficulty(service: Service): number {
    // 1. Scarcity: How many people can physically do this?
    const eligibleCount = this.staff.filter(s => 
        service.allowedRoles.includes(s.role) && 
        s.offDays.length < 15 && // Rough heuristic: Don't count unavailable people
        (service.preferredGroup === 'Farketmez' || !service.preferredGroup || s.group === service.preferredGroup)
    ).length;

    // Base score: Fewer staff = Higher difficulty
    // 1000 base ensures it's always positive.
    let score = 2000 - (eligibleCount * 20);

    // 2. Demand: Higher daily count = Harder
    score += (service.minDailyCount * 100);

    // 3. Priority Roles: If strictly defined, it's harder
    if (service.priorityRoles && service.priorityRoles.length > 0) {
        score += 50;
    }

    // 4. Emergency: Usually harder due to lower quotas/higher stress
    if (service.isEmergency) {
        score += 100;
    }

    return score;
  }

  public generate(): ScheduleResult {
    this.logs = []; // Reset logs
    
    if (this.config.useGeneticAlgorithm) {
      this.log("MOD: Genetik Algoritma (Evolutionary Solver) Aktif.");
      this.log("Bilgi: Popülasyon oluşturuluyor ve evrimleştiriliyor...");
      return this.generateGenetic();
    } else {
      this.log("MOD: Monte Carlo Simülasyonu (Standart) Aktif.");
      this.log(`Bilgi: ${this.config.maxRetries} deneme yapılacak.`);
      return this.generateMonteCarlo();
    }
  }

  // --- MONTE CARLO METHOD (Existing) ---
  private generateMonteCarlo(): ScheduleResult {
    let bestResult: ScheduleResult | null = null;
    let minUnfilled = Infinity;
    let bestDeviation = Infinity;

    // Retry mechanism (Monte Carlo)
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      // Keep logs from previous attempts if needed, but usually we just want the final result's logs.
      // However, we want to capture the initialization log.
      const tempLogs = [...this.logs]; 
      const currentResult = this.runSimulation(attempt);
      currentResult.logs = tempLogs; // Preserve init logs

      const deviation = this.calculateDeviation(currentResult);

      // Criteria 1: Unfilled Slots (Must be minimal)
      if (currentResult.unfilledSlots < minUnfilled) {
        minUnfilled = currentResult.unfilledSlots;
        bestDeviation = deviation;
        bestResult = currentResult;
      } 
      // Criteria 2: Quota Deviation (Secondary to filling slots)
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

  // --- GENETIC ALGORITHM METHOD (New) ---
  private generateGenetic(): ScheduleResult {
    const POPULATION_SIZE = 50;
    const GENERATIONS = 20;
    const ELITISM_COUNT = 5;

    // 1. Initialize Population
    let population: ScheduleResult[] = [];
    for (let i = 0; i < POPULATION_SIZE; i++) {
        // Use random seeds for initial population
        const res = this.runSimulation(i);
        res.logs = [...this.logs]; // Preserve init logs
        population.push(res);
    }

    for (let gen = 0; gen < GENERATIONS; gen++) {
        // 2. Evaluate Fitness
        // Fitness = (Unfilled * 10000) + Deviation. Lower is better.
        population.forEach(ind => {
            ind.fitness = (ind.unfilledSlots * 10000) + this.calculateDeviation(ind);
        });

        // Sort by fitness (Ascending)
        population.sort((a, b) => (a.fitness || 0) - (b.fitness || 0));

        // Early exit if perfect
        if (population[0].fitness === 0) return population[0];

        // 3. Selection (Elitism)
        const newPopulation = population.slice(0, ELITISM_COUNT);

        // 4. Crossover & Mutation
        while (newPopulation.length < POPULATION_SIZE) {
            // Select parents (Tournament or simple top-tier)
            const parentA = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))]; // Pick from top half
            const parentB = population[Math.floor(Math.random() * (POPULATION_SIZE / 2))];

            let child: ScheduleResult;

            // 70% Crossover, 30% Mutation of existing
            if (Math.random() < 0.7) {
                child = this.crossover(parentA, parentB);
            } else {
                child = this.mutate(parentA);
            }
            
            child.logs = [...this.logs]; // Preserve init logs
            newPopulation.push(child);
        }

        population = newPopulation;
    }

    // Return best of final generation
    population.sort((a, b) => (a.fitness || 0) - (b.fitness || 0));
    this.log(`Genetik Algoritma Tamamlandı. En iyi skor: ${population[0].fitness}`);
    return population[0];
  }

  private calculateDeviation(result: ScheduleResult): number {
    return result.stats.reduce((acc, s) => {
        const staffDef = this.staff.find(st => st.id === s.staffId);
        if (!staffDef) return acc;
        return acc + Math.abs(staffDef.quotaService - s.serviceShifts) + Math.abs(staffDef.quotaEmergency - s.emergencyShifts);
    }, 0);
  }

  /**
   * Splits two schedules at a random day and merges them.
   * Repairs boundary conflicts (e.g. working Day X and Day X+1).
   */
  private crossover(parentA: ScheduleResult, parentB: ScheduleResult): ScheduleResult {
     const splitDay = Math.floor(Math.random() * (this.daysInMonth - 2)) + 2; // Split between 2 and end-1
     
     const newSchedule: DaySchedule[] = [];
     
     // Copy Part A
     for(let d=1; d<=splitDay; d++) {
         const day = parentA.schedule.find(s => s.day === d)!;
         // Deep copy assignments
         newSchedule.push({ ...day, assignments: [...day.assignments.map(a => ({...a}))] });
     }

     // Copy Part B
     for(let d=splitDay+1; d<=this.daysInMonth; d++) {
         const day = parentB.schedule.find(s => s.day === d)!;
         // Deep copy
         newSchedule.push({ ...day, assignments: [...day.assignments.map(a => ({...a}))] });
     }

     // REPAIR BOUNDARY (SplitDay vs SplitDay+1)
     const dayBefore = newSchedule.find(s => s.day === splitDay);
     const dayAfter = newSchedule.find(s => s.day === splitDay + 1);

     if (dayBefore && dayAfter) {
         const workersBefore = new Set(dayBefore.assignments.map(a => a.staffId));
         
         // Find conflicts: Staff working on boundary days
         dayAfter.assignments.forEach((assign, idx) => {
             if (assign.staffId !== 'EMPTY' && workersBefore.has(assign.staffId)) {
                 // Conflict! Remove from Day After (simplest repair)
                 // Ideally we try to fill it, but for simple Crossover we just empty it 
                 // and let the Mutation phase or next generation fix/fill it.
                 // However, to be robust, let's mark it empty.
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

  /**
   * Clears random days or empty slots and attempts to refill them using the simulation logic.
   */
  private mutate(parent: ScheduleResult): ScheduleResult {
     const newSchedule = parent.schedule.map(d => ({ ...d, assignments: d.assignments.map(a => ({...a})) }));
     
     // 1. Identify weak days (days with empty slots or high stress?)
     const problemDays = newSchedule.filter(d => d.assignments.some(a => a.staffId === 'EMPTY')).map(d => d.day);
     
     // 2. Or pick random days if no obvious problems
     if (problemDays.length === 0) {
         const r = Math.floor(Math.random() * this.daysInMonth) + 1;
         problemDays.push(r);
     }

     // 3. Clear and Refill
     // Note: This is a partial re-simulation. It's complex to wire up 'runSimulation' for just one day 
     // without full context. 
     // Simplified Mutation: Swap two people on a random day.
     
     const mutationDayNum = problemDays[Math.floor(Math.random() * problemDays.length)];
     const dayObj = newSchedule.find(d => d.day === mutationDayNum);
     
     if (dayObj && dayObj.assignments.length >= 2) {
         // Try to swap two assignments
         const idx1 = Math.floor(Math.random() * dayObj.assignments.length);
         const idx2 = Math.floor(Math.random() * dayObj.assignments.length);
         
         if (idx1 !== idx2) {
             const a1 = dayObj.assignments[idx1];
             const a2 = dayObj.assignments[idx2];
             
             // Check if swap is valid (Role check)
             const s1Service = this.services.find(s => s.id === a1.serviceId);
             const s2Service = this.services.find(s => s.id === a2.serviceId);
             
             // Very basic validity check
             if (s1Service && s2Service && a1.staffId !== 'EMPTY' && a2.staffId !== 'EMPTY') {
                 const p1 = this.staff.find(s => s.id === a1.staffId);
                 const p2 = this.staff.find(s => s.id === a2.staffId);
                 
                 if (p1 && p2 && s1Service.allowedRoles.includes(p2.role) && s2Service.allowedRoles.includes(p1.role)) {
                     // Perform Swap
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
          const isWknd = this.isWeekend(day.day);
          const isSat = this.getDayOfWeek(day.day) === 6;
          const isSun = this.getDayOfWeek(day.day) === 0;
          const isHol = this.config.holidays.includes(day.day);

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
    const assignments = assignmentsMap.get(day);
    if (!assignments) return false;
    return assignments.some(a => a.staffId === staffId);
  }

  private runSimulation(attemptIndex: number): ScheduleResult {
    const dayAssignmentsMap = new Map<number, ShiftAssignment[]>();
    for(let d=1; d<=this.daysInMonth; d++) {
        dayAssignmentsMap.set(d, []);
    }

    const staffStats = new Map<string, { total: number, service: number, emergency: number, weekend: number, saturday: number, sunday: number }>();
    this.staff.forEach(s => staffStats.set(s.id, { total: 0, service: 0, emergency: 0, weekend: 0, saturday: 0, sunday: 0 }));

    // FATIGUE MODEL STATE
    const staffStress = new Map<string, number>(); // Current stress level for each staff
    this.staff.forEach(s => staffStress.set(s.id, 0));

    let unfilledSlots = 0;

    // 1. Identify max layers needed (maxDailyCount of any service)
    const maxLayer = Math.max(...this.services.map(s => s.maxDailyCount));

    // 2. Identify all days
    const allDays = Array.from({length: this.daysInMonth}, (_, i) => i + 1);

    // 3. Sort services by difficulty (Hardest first)
    const sortedServices = [...this.services].sort((a, b) => {
        return this.getServiceDifficulty(b) - this.getServiceDifficulty(a);
    });

    // GLOBAL LOOP: LAYER -> DAY -> SERVICE
    for (let layer = 0; layer < maxLayer; layer++) {
        
        // ZOR GÜN ÖNCELİĞİ (Hardest Day First)
        const sortedDays = [...allDays].sort((a, b) => {
            const dayA = this.getDayOfWeek(a);
            const dayB = this.getDayOfWeek(b);
            const isHolidayA = this.config.holidays.includes(a);
            const isHolidayB = this.config.holidays.includes(b);

            const getPriority = (d: number, isHol: boolean) => {
                 if (isHol) return 1100;
                 if (d === 6) return 1000;
                 if (d === 0) return 900;
                 if (d === 5) return 800;
                 if (d === 4) return 700;
                 return Math.random() * 100;
            };

            return getPriority(dayB, isHolidayB) - getPriority(dayA, isHolidayA);
        });

        for (const day of sortedDays) {
             // FATIGUE DECAY (Simulated Daily Recovery)
             // Since we visit days in random order, we can't simulate strictly chronological decay here easily 
             // without a chronological loop.
             // However, for the "Hardest Day First" logic, we use a heuristic penalty in findBestCandidate instead.
             // But to be accurate, let's update stress when ASSIGNING.
             
             const dayOfWeek = this.getDayOfWeek(day);
             const isHoliday = this.config.holidays.includes(day);
             const isWeekendReal = dayOfWeek === 6 || dayOfWeek === 0;
             const isWeekendOrHoliday = isWeekendReal || isHoliday;
             
             const isSat = dayOfWeek === 6;
             const isSun = dayOfWeek === 0;
             const isThu = dayOfWeek === 4;

             const currentDayAssignments = dayAssignmentsMap.get(day)!;
             const assignedTodayIds = new Set(currentDayAssignments.map(a => a.staffId));
             const dayGroupCounts: Record<string, number> = {};
             currentDayAssignments.forEach(a => {
                 if (a.group) dayGroupCounts[a.group] = (dayGroupCounts[a.group] || 0) + 1;
             });

             for (const service of sortedServices) {
                const mustFill = service.minDailyCount > layer;
                const canFill = service.maxDailyCount > layer;

                if (!canFill) continue;

                const currentCount = currentDayAssignments.filter(a => a.serviceId === service.id).length;
                if (currentCount > layer) continue;

                // Desperation logic
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
                    dayGroupCounts[bestCandidate.group] = (dayGroupCounts[bestCandidate.group] || 0) + 1;
                    
                    // Update Stats
                    const stats = staffStats.get(bestCandidate.id)!;
                    stats.total++;
                    if (service.isEmergency) stats.emergency++; else stats.service++;
                    if (isWeekendOrHoliday) stats.weekend++;
                    if (isSat) stats.saturday++;
                    if (isSun) stats.sunday++;

                    // FATIGUE UPDATE
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
        schedule.push({
            day: d,
            assignments: dayAssignmentsMap.get(d) || [],
            isWeekend: this.isWeekend(d),
            isHoliday: this.config.holidays.includes(d)
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
      
      const candidates = this.staff
        .filter(person => {
          // --- HARD CONSTRAINTS ---
          if (!service.allowedRoles.includes(person.role)) return false;
          if (assignedTodayIds.has(person.id)) return false;
          if (person.offDays.includes(day)) return false;
          if (service.preferredGroup && service.preferredGroup !== 'Farketmez') {
              if (person.group !== service.preferredGroup) return false;
          }
          if (this.hasShiftOnDay(dayAssignmentsMap, day - 1, person.id)) return false;
          if (this.hasShiftOnDay(dayAssignmentsMap, day + 1, person.id)) return false;

          const stats = staffStats.get(person.id)!;

          // --- SOFT CONSTRAINTS ---
          if (!desperateMode) {
              if (isWeekendOrHoliday) {
                  const prevThursday = isSat ? day - 2 : (isSun ? day - 3 : -1);
                  if (prevThursday > 0 && this.hasShiftOnDay(dayAssignmentsMap, prevThursday, person.id)) {
                      return false;
                  }
              }

              if (isThu) {
                  const nextSat = day + 2;
                  const nextSun = day + 3;
                  if (nextSat <= this.daysInMonth && this.hasShiftOnDay(dayAssignmentsMap, nextSat, person.id)) return false;
                  if (nextSun <= this.daysInMonth && this.hasShiftOnDay(dayAssignmentsMap, nextSun, person.id)) return false;
              }

              if (service.isEmergency) {
                if (stats.emergency >= person.quotaEmergency) return false;
              } else {
                if (stats.service >= person.quotaService) return false;
              }
              
              if (isWeekendOrHoliday && stats.weekend >= person.weekendLimit) return false;
              if (isSat && stats.saturday >= stats.sunday + 1) return false;
              if (isSun && stats.sunday >= stats.saturday + 1) return false;
          }

          return true;
        })
        .map(person => {
          const stats = staffStats.get(person.id)!;
          let score = 0;

          // 1. Priority Role Boost
          if (service.priorityRoles && service.priorityRoles.includes(person.role)) {
              score -= 20000;
          }

          // 2. Requested Day
          if (person.requestedDays && person.requestedDays.includes(day)) {
              score -= 50000;
          }

          // 3. Quota Distance
          const target = service.isEmergency ? person.quotaEmergency : person.quotaService;
          const current = service.isEmergency ? stats.emergency : stats.service;
          const remaining = target - current;
          score -= (remaining * 5000); 

          // 4. RESOURCE PRESERVATION
          const personFlexibility = this.staffFlexibilityScore.get(person.id) || 1;
          const isGenericService = service.allowedRoles.length > 3; 
          if (personFlexibility <= 2 && !isGenericService) score -= 5000;
          if (personFlexibility > 4 && isGenericService && !desperateMode) score += 2000;

          // 5. Anti-Cluster
          if (this.config.preventEveryOtherDay && !desperateMode) {
              if (this.hasShiftOnDay(dayAssignmentsMap, day - 2, person.id)) score += 4000;
              if (this.hasShiftOnDay(dayAssignmentsMap, day + 2, person.id)) score += 4000;
          }

          // 6. Group Balance
          const groupCount = dayGroupCounts[person.group] || 0;
          score += (groupCount * 2500);

          // 7. FATIGUE MODEL (NEW)
          if (this.config.useFatigueModel) {
              const currentStress = staffStress.get(person.id) || 0;
              // Higher stress = Higher score penalty (Less likely to be picked)
              // Penalty factor: 50 points per stress unit
              score += currentStress * 50; 
              
              // Extreme burnout protection: If stress is excessively high compared to average, force skip
              // This acts as a soft "break"
              if (!desperateMode && currentStress > 100) { 
                  score += 100000; 
              }
          }

          // 8. Random Jitter
          score += Math.random() * 500;

          return { person, score };
        });

      candidates.sort((a, b) => a.score - b.score);

      return candidates.length > 0 ? candidates[0].person : null;
  }
}