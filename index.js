"use strict";

const _ = require('lodash');

const stats = module.exports = {};

/**
 * Binary search for bin
 * @param sortedValues - bin boundaries
 * @param target - value to bin
 * @returns {{indexes: [number,number], values: [number,number]}}
 * @private
 */
stats._bin = function (sortedValues, target) {
    // find bounding indexes
    let lo, mid, hi;
    if (target < sortedValues[0]) {
        hi = 0;
    } else if (target >= _.last(sortedValues)) {
        lo = sortedValues.length - 1;
    } else {
        lo = 0;
        hi = sortedValues.length - 1;
        while (hi - lo > 1) {
            mid = _.floor((lo + hi) / 2);
            if (sortedValues[mid] <= target) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
    }

    // return boundary indexes and values
    const loVal = _.isNil(lo) ? -Infinity : sortedValues[lo];
    const hiVal = _.isNil(hi) ? Infinity : sortedValues[hi];
    return {
        indexes: [lo, hi],
        values: [loVal, hiVal]
    };
};

/**
 * Cumulative Distribution Function class
 * @description the probability of being greater than or equal to a value in a given set, p = CDF(x)
 * @type {exports.CumulativeDistributionFunction}
 */
stats.CumulativeDistributionFunction = class {
    /**
     * Constructor
     * @param [values]
     * @param [probabilityMap]
     */
    constructor({ values, probabilityMap }) {
        this.values = _.sortBy(values);
        this.set = _.uniq(this.values);
        this.probabilityMap = probabilityMap;

        // compute probability map if not provided - normalize percentile rank
        if (!this.probabilityMap) {
            this.probabilityMap = {};
            _.forEach(this.values, (value, idx) => {
                this.probabilityMap[value] = (idx + 1) / this.values.length;
            });
        }
    }

    /**
     * get interquartile range
     * @returns {number}
     */
    get interquartileRange() {
        // cache IQR
        if (_.isNil(this._interquartileRange)) {
            this._interquartileRange = this.percentile(75) - this.percentile(25);
        }
        return this._interquartileRange;
    }

    /**
     * get median computed from CDF
     * @returns {number}
     */
    get median() {
        // cache median
        if (_.isNil(this._median)) {
            this._median = this.value(0.5);
        }
        return this._median;
    }

    /**
     * get percentile for a given percentile rank
     * @param percentileRank
     * @returns {number}
     */
    percentile(percentileRank) {
        const prob = percentileRank / 100;
        return this.value(prob);
    }

    /**
     * get percentile rank for a given value
     * @param value
     * @returns {number}
     */
    percentileRank(value) {
        return this.probability(value) * 100;
    }

    /**
     * get probability rank for a given value
     * @param value
     * @returns {number}
     */
    probability(value) {
        const prob = this.probabilityMap[value];
        if (prob) return prob;

        // value is not explicitly in map, determine probability by its bin
        const bin = stats._bin(this.set, value);

        // 0 probability if value is less than the min,
        if (_.isNil(bin.indexes[0])) return 0;

        return this.probabilityMap[bin.values[0]];
    }

    /**
     * get value for a given probability rank
     * @param probability
     * @returns {number}
     */
    value(probability) {
        let value = _.findKey(this.probabilityMap, prob => prob === probability);
        if (!value) {
            // given probability is not explicitly in map, determine by its bin
            const probabilities = _.map(this.probabilityMap);
            const bin = stats._bin(probabilities, probability);
            value = _.findKey(this.probabilityMap, prob => prob === bin.values[1]);
        }
        return _.toNumber(value);
    }
};

/**
 * Compute effect size
 * @param values1
 * @param values2
 * @returns {number}
 */
stats.effectSize = function (values1, values2) {
    const mean1 = this.mean(values1);
    const mean2 = this.mean(values2);
    let x1 = 0;
    _.forEach(values1, value => {
        x1 += Math.pow((value - mean1), 2);
    });
    let x2 = 0;
    _.forEach(values2, value => {
        x2 += Math.pow((value - mean2), 2);
    });
    const pooledVar = (x1 + x2) / (values1.length + values2.length);
    return (mean1 - mean2) / Math.sqrt(pooledVar);
};

/**
 * Compute frequency
 * @param values
 * @param target
 * @returns {number}
 */
stats.frequency = function (values, target) {
    let freq = 0;
    _.forEach(values, value => {
        if (value === target) freq += 1;
    });
    return freq;
};

/**
 * Alias of {@link frequency}
 * @type {exports.frequency|*}
 */
stats.freq = stats.frequency;

/**
 * Histogram class
 * @type {exports.Histogram}
 */
stats.Histogram = class {
    /**
     * Constructor
     * @param [values]
     * @param [frequencyMap]
     */
    constructor({ values, frequencyMap }) {
        this.values = values;
        this.frequencyMap = frequencyMap;

        // compute frequency map if not provided
        if (!this.frequencyMap) {
            this.frequencyMap = stats.histogram(this.values);
        }
    }

    /**
     * Get frequency for given value
     * @param value
     * @returns {number}
     */
    frequency(value) {
        return this.frequencyMap[value];
    }

    /**
     * get mode
     * @returns {{value: *, frequency: number}|*}
     */
    get mode() {
        // cache mode
        if (!this._mode) {
            let maxFreq = 0;
            let mode;
            _.forEach(this.frequencyMap, (freq, value) => {
                value = _.toNumber(value);
                if (freq > maxFreq) {
                    maxFreq = freq;
                    mode = value;
                }
            });
            this._mode = { value: mode, frequency: maxFreq };
        }
        return this._mode;
    }
};

/**
 * Compute histogram
 * @param values
 * @returns {object}
 */
stats.histogram = function (values) {
    const hist = {};
    _.forEach(values, value => {
        if (!hist[value]) hist[value] = 0;
        hist[value] += 1;
    });
    return hist;
};

/**
 * Alias of {@link histogram}
 * @type {exports.histogram|*}
 */
stats.hist = stats.histogram;

/**
 * Compute mean
 * @param values
 * @returns {number}
 */
stats.mean = function (values) {
    return _.mean(values);
};

/**
 * Compute median
 * @param values
 * @returns {number}
 */
stats.median = function (values) {
    const sorted = _.sortBy(values);
    const i = _.round(values.length / 2);

    // if n is odd
    if (values.length % 2) {
        return sorted[i];
    } else {
        return (sorted[i] + sorted[i - 1]) / 2;
    }
};

/**
 * Compute mode
 * @description most frequent value in a set
 * @param values
 * @returns {number}
 */
stats.mode = function (values) {
    const hist = this.histogram(values);
    let maxFreq = 0;
    let mode;
    _.forEach(values, value => {
        const freq = hist[value];
        if (freq > maxFreq) {
            maxFreq = freq;
            mode = value;
        }
    });
    return { value: mode, frequency: maxFreq };
};

/**
 * Compute percentile rank
 * @description the percentage of values that are LTE the target
 * @param values
 * @param target
 * @returns {number}
 */
stats.percentileRank = function (values, target) {
    let count = 0;
    _.forEach(values, value => {
        if (value <= target) count += 1;
    });
    return 100 * count / values.length;
};

/**
 * Compute percentile
 * @description the value in the given set with the given percentile rank
 * @param values
 * @param percentileRank
 * @returns {number}
 */
stats.percentile = function (values, percentileRank) {
    values = _.sortBy(values);
    const idx = (percentileRank * values.length / 100) - 1;
    return values[idx];
};

/**
 * Probability Mass Function class
 * @type {exports.ProbabilityMassFunction}
 */
stats.ProbabilityMassFunction = class {
    /**
     * Constructor
     * @param [values]
     * @param [probabilityMap]
     * @param options
     */
    constructor({ values, probabilityMap }, options) {
        this.values = values;
        this.probabilityMap = probabilityMap;

        // compute probability map if not provided
        if (!this.probabilityMap) {
            const histogram = new stats.Histogram({ values });
            this.probabilityMap = {};
            _.forEach(histogram.frequencyMap, (freq, value) => {
                this.probabilityMap[value] = freq / this.values.length;
            });
        }

        // if values are a sampling of members the , the distribution will have a sample bias
        if (options && options.familySizeBias) {
            this.unbiasForFamilySize();
        }
    }

    /**
     * Estimate bias for family size
     */
    biasForFamilySize() {
        _.forEach(this.probabilityMap, (prob, value) => {
            this.probabilityMap[value] = this.probabilityMap[value] * value;
        });
        this.normalize();
    }

    /**
     * Get mean computed from PMF
     * @returns {number}
     */
    get mean() {
        // cache mean
        if (_.isNil(this._mean)) {
            // compute from probability distribution
            let mean = 0;
            _.forEach(this.probabilityMap, (prob, value) => {
                mean += prob * value;
            });
            this._mean = mean;
        }
        return this._mean;
    }

    /**
     * Normalize probability distribution
     */
    normalize() {
        let total = 0;
        _.forEach(this.probabilityMap, prob => {
            total += prob;
        });
        _.forEach(this.probabilityMap, (prob, value) => {
            this.probabilityMap[value] = prob / total;
        });
    }

    /**
     * Get probability for given value
     * @param value
     * @returns {number}
     */
    probability(value) {
        return this.probabilityMap[value];
    }

    /**
     * Get standard deviation computed from PMF
     * @returns {number}
     */
    get standardDeviation() {
        // cache stdev
        if (_.isNil(this._standardDeviation)) {
            // compute from probability distribution
            this._standardDeviation = Math.sqrt(this.variance);
        }
        return this._standardDeviation;
    }

    /**
     * Estimate true distribution assuming a family-size bias
     */
    unbiasForFamilySize() {
        _.forEach(this.probabilityMap, (prob, value) => {
            this.probabilityMap[value] = this.probabilityMap[value] / value;
        });
        this.normalize();
    }

    /**
     * Get variance computed from PMF
     * @returns {number}
     */
    get variance() {
        // cache variance
        if (_.isNil(this._variance)) {
            // compute from probability distribution
            let variance = 0;
            _.forEach(this.probabilityMap, (prob, value) => {
                variance += prob * Math.pow((value - this.mean), 2);
            });
            this._variance = variance;
        }
        return this._variance;
    }
};

/**
 * Compute standard deviation
 * @param values
 * @returns {number}
 */
stats.standardDeviation = function (values) {
    return Math.sqrt(this.variance(values));
};

/**
 * Alias of {@link standardDeviation}
 * @type {exports.standardDeviation|*}
 */
stats.stdev = stats.standardDeviation;

/**
 * Compute variance
 * @param values
 * @returns {number}
 */
stats.variance = function (values) {
    const mean = this.mean(values);
    let x = 0;
    _.forEach(values, value => {
        x += Math.pow((value - mean), 2);
    });
    return x / values.length;
};

/**
 * Alias of {@link variance}
 * @type {exports.variance|*}
 */
stats.var = stats.variance;
