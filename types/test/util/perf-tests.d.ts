import type { FrameworkInfo, TestConfig } from './framework-types';
export interface TestResult {
    sum: number;
    count: number;
}
export interface TimingResult<T> {
    result: T;
    timing: TestTiming;
}
export interface TestTiming {
    time: number;
}
export declare function verifyBenchResult(perfFramework: FrameworkInfo, config: TestConfig, timedResult: TimingResult<TestResult>): void;
