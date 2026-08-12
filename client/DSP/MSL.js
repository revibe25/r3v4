export var MSL;
(function (MSL) {
    MSL.EPSILON = 1.17549435e-38; // Float32 min normal
    MSL.DC_OFFSET = 1e-15;
    function log10(x) {
        return x > 0 ? Math.log(x) / Math.LN10 : -Infinity;
    }
    MSL.log10 = log10;
    function dbToLinear(db) {
        if (db < -144)
            return 6.3e-8;
        return Math.pow(10, db / 20);
    }
    MSL.dbToLinear = dbToLinear;
    function linearToDb(x) {
        return (x < MSL.EPSILON) ? -144 : 20 * Math.log10(Math.max(x, MSL.EPSILON));
    }
    MSL.linearToDb = linearToDb;
    function denormalProtect(x) {
        // avoid denormals
        if (Math.abs(x) < MSL.EPSILON)
            return 0;
        return x;
    }
    MSL.denormalProtect = denormalProtect;
    function sanitize(x) {
        if (!Number.isFinite(x) || Number.isNaN(x))
            return 0.0;
        return x;
    }
    MSL.sanitize = sanitize;
    function softClip(x) {
        return Math.tanh(x);
    }
    MSL.softClip = softClip;
})(MSL || (MSL = {}));
