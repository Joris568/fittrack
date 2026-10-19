import { describe, expect, it } from "vitest";
import { aliasFor, guessMuscleGroup, normalizeExerciseName, parseCsv, parseFlexibleDate, parseWorkoutCsv } from "./csvImport.js";

describe("csv parsing", () => {
  it("handles quotes, escaped quotes, commas inside fields and CRLF", () => {
    const rows = parseCsv('a,b,c\r\n"x, y","he said ""hi""",3\r\n');
    expect(rows).toEqual([["a", "b", "c"], ["x, y", 'he said "hi"', "3"]]);
  });

  it("detects semicolon-delimited files", () => {
    expect(parseCsv("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("dates", () => {
  it("reads Strong and Hevy formats as the user's local time", () => {
    // Dutch summer time: tz = -120 → 18:30 local = 16:30 UTC
    expect(parseFlexibleDate("2024-07-05 18:30:00", -120)?.toISOString()).toBe("2024-07-05T16:30:00.000Z");
    expect(parseFlexibleDate("5 Jul 2024, 18:30", -120)?.toISOString()).toBe("2024-07-05T16:30:00.000Z");
    expect(parseFlexibleDate("05-07-2024 18:30", -120)?.toISOString()).toBe("2024-07-05T16:30:00.000Z");
    expect(parseFlexibleDate("garbage", 0)).toBeNull();
  });
});

describe("workout import", () => {
  it("parses a Strong export, groups sets into sessions, converts lbs and flags junk rows", () => {
    const csv = [
      "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
      '2024-03-05 18:30:00,Push A,1h,"Bench Press (Barbell)",1,200,8,0,0,,,8',
      '2024-03-05 18:30:00,Push A,1h,"Bench Press (Barbell)",2,200,7,0,0,,,',
      "2024-03-05 18:30:00,Push A,1h,Plank,1,0,0,0,60,,,",
      '2024-03-07 18:30:00,Pull A,1h,"Lat Pulldown (Cable)",1,120,10,0,0,,,',
    ].join("\n");
    const r = parseWorkoutCsv(csv, 0, "lbs");
    expect(r.sessions).toHaveLength(2);
    expect(r.sessions[0].name).toBe("Push A");
    expect(r.sessions[0].sets).toHaveLength(2);
    expect(r.sessions[0].sets[0]).toMatchObject({ reps: 8, rpe: 8, isWarmup: false });
    expect(r.sessions[0].sets[0].weight).toBeCloseTo(90.72, 1);
    expect(r.skippedRows).toBe(1); // the plank has no reps
  });

  it("parses a Hevy export with kg, warm-up set types and a different date format", () => {
    const csv = [
      "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe",
      '"Upper","5 Mar 2024, 18:30","5 Mar 2024, 19:30","","Overhead Press (Barbell)",,"",0,warmup,40,10,,,',
      '"Upper","5 Mar 2024, 18:30","5 Mar 2024, 19:30","","Overhead Press (Barbell)",,"",1,normal,60,8,,,9',
    ].join("\n");
    const r = parseWorkoutCsv(csv, 0);
    expect(r.sessions[0].sets.map((s) => s.isWarmup)).toEqual([true, false]);
    expect(r.sessions[0].sets[1]).toMatchObject({ weight: 60, reps: 8, rpe: 9 });
  });

  it("explains itself on an unknown file", () => {
    expect(parseWorkoutCsv("foo,bar\n1,2", 0).error).toMatch(/herken ik niet/);
  });
});

describe("exercise matching", () => {
  it("maps common English names to ours and guesses a muscle group for the rest", () => {
    expect(normalizeExerciseName("Bench Press (Barbell)")).toBe("bench press");
    expect(aliasFor("Lateral Raise (Dumbbell)")).toBe("Lateral raise");
    expect(aliasFor("Some Weird Machine")).toBeNull();
    expect(guessMuscleGroup("Cable Fly")).toBe("Borst");
    expect(guessMuscleGroup("Weird Thing")).toBe("Overig");
  });
});
