// WARN-7: original had no cancel handle and spammed console.log at 60 fps.
// Accept an optional logger (default: no-op) and return a cancel function.
export function measureFPS(callback, logger = () => undefined) {
    let last = performance.now();
    let handle = 0;
    function loop(now) {
        const fps = 1000 / (now - last);
        last = now;
        logger(fps);
        callback();
        handle = requestAnimationFrame(loop);
    }
    handle = requestAnimationFrame(loop);
    // Return a cancel function
    return () => { cancelAnimationFrame(handle); };
}
