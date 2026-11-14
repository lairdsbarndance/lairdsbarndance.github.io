function measure_page_performance(duration = 10000) {
    const start_time = performance.now();
    const frame_times = [];
    let last_frame_time = start_time;
    let long_task_count = 0;
    let long_task_duration = 0;
    const initial_heap = performance.memory?.usedJSHeapSize ?? null;
    let observer = null;

    const record_long_tasks = entries => {
        entries.forEach(entry => {
            long_task_count++;
            long_task_duration += entry.duration;
        });
    };

    if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
        try {
            observer = new PerformanceObserver(list => record_long_tasks(list.getEntries()));
            observer.observe({entryTypes: ["longtask"]});
        } catch (error) {
            observer = null;
        }
    }

    return new Promise(resolve => {
        function finish() {
            const duration_ms = performance.now() - start_time;

            if (observer) {
                record_long_tasks(observer.takeRecords());
                observer.disconnect();
            }

            const sorted_frame_times = [...frame_times].sort((a, b) => a - b);
            const average_fps = frame_times.length / (duration_ms / 1000);
            const median_frame_time = sorted_frame_times.length
                ? sorted_frame_times[Math.floor(sorted_frame_times.length / 2)]
                : 0;
            const percentile_95 = sorted_frame_times.length
                ? sorted_frame_times[Math.ceil(sorted_frame_times.length * 0.95) - 1]
                : 0;
            const slow_frames = frame_times.filter(frame_time => frame_time > 16.7).length;
            const very_slow_frames = frame_times.filter(frame_time => frame_time > 33.3).length;
            const final_heap = performance.memory?.usedJSHeapSize ?? null;

            const results = {
                duration: `${(duration_ms / 1000).toFixed(1)} seconds`,
                average_fps: Number(average_fps.toFixed(1)),
                median_frame_time: `${median_frame_time.toFixed(1)} ms`,
                percentile_95: `${percentile_95.toFixed(1)} ms`,
                frames_over_16_7ms: `${slow_frames} (${(slow_frames / Math.max(frame_times.length, 1) * 100).toFixed(1)}%)`,
                frames_over_33_3ms: `${very_slow_frames} (${(very_slow_frames / Math.max(frame_times.length, 1) * 100).toFixed(1)}%)`,
                long_tasks: long_task_count,
                long_task_duration: `${long_task_duration.toFixed(1)} ms`,
                heap_change: initial_heap !== null && final_heap !== null
                    ? `${((final_heap - initial_heap) / 1048576).toFixed(2)} MB`
                    : "Not available"
            };

            console.group(`Page performance — ${results.duration}`);
            console.table([
                {metric: "Average frame rate", result: `${results.average_fps} FPS`},
                {metric: "Median frame time", result: results.median_frame_time},
                {metric: "95th percentile frame time", result: results.percentile_95},
                {metric: "Frames over 16.7 ms", result: results.frames_over_16_7ms},
                {metric: "Frames over 33.3 ms", result: results.frames_over_33_3ms},
                {metric: "Long tasks (>50 ms)", result: results.long_tasks},
                {metric: "Time spent in long tasks", result: results.long_task_duration},
                {metric: "JavaScript heap change", result: results.heap_change}
            ]);
            console.groupEnd();

            resolve(results);
        }

        function sample_frame(now) {
            frame_times.push(now - last_frame_time);
            last_frame_time = now;

            if (now - start_time >= duration) {
                finish();
            } else {
                requestAnimationFrame(sample_frame);
            }
        }

        requestAnimationFrame(sample_frame);
    });
}

measure_page_performance();
