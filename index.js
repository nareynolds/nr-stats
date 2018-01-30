"use strict";

const _ = require('lodash');

const stats = module.exports = {};

/**
 * Binary search for bin
 * @param sortedBins - bin boundaries [n, n+1)
 * @param value - value to bin
 * @returns {{indexes: [number,number], values: [number,number]}}
 * @private
 */
stats._bin = function (sortedBins, value) {
    // find bounding indexes
    let lo, mid, hi;
    if (value < sortedBins[0]) {
        hi = 0;
    } else if (value >= _.last(sortedBins)) {
        lo = sortedBins.length - 1;
    } else {
        lo = 0;
        hi = sortedBins.length - 1;
        while (hi - lo > 1) {
            mid = _.floor((lo + hi) / 2);
            if (sortedBins[mid] <= value) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
    }

    // return boundary indexes and values
    const loVal = _.isNil(lo) ? -Infinity : sortedBins[lo];
    const hiVal = _.isNil(hi) ? Infinity : sortedBins[hi];
    return {
        indexes: [lo, hi],
        values: [loVal, hiVal]
    };
};

/**
 * Compute moment about the mean
 * @param values
 * @param ordinal
 * @returns {number}
 */
stats.centralMoment = function (values, ordinal) {
    const mean = this.mean(values);
    return this.moment(values, ordinal, mean);
};

/**
 * Cumulative Mass Function (a.k.a. Cumulative Distribution Function) class
 * @description the probability of being greater than or equal to a value in a given set, p = CDF(x)
 * @type {exports.CumulativeMassFunction}
 */
stats.CumulativeMassFunction = class {
    /**
     * Constructor
     * @param [probabilityMap]
     * @param [values]
     */
    constructor({ probabilityMap, values }) {
        this.probabilityMap = probabilityMap;
        this.values = _.sortBy(values);
        this.set = _.uniq(this.values);

        // compute probability map if not provided - normalize percentile rank
        if (!this.probabilityMap) {
            this.probabilityMap = {};
            _(this.values).sortBy().forEach((value, idx) => {
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
     * Generate PMF from this CMF by computing its derivative
     * @returns {ProbabilityMassFunction}
     */
    toProbabilityMassFunction() {
        const probabilityMap = {};
        let prevProb = 0;
        let diff;
        _.forEach(this.probabilityMap, (prob, value) => {
            diff = _.round(prob - prevProb, 15); // to prevent binary computation inaccuracies
            probabilityMap[value] = diff;
            prevProb = prob;
        });
        return new stats.ProbabilityMassFunction({ probabilityMap, values: this.values });
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

// TODO: GaussianDistribution

/**
 * Histogram class
 * @type {exports.Histogram}
 */
stats.Histogram = class {
    /**
     * Constructor
     * @param [frequencyMap]
     * @param [values]
     */
    constructor({ frequencyMap, values }) {
        this.frequencyMap = frequencyMap;
        this.values = values;

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
    values = _.sortBy(values);
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
    return this.rawMoment(values);
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
 * Compute moment
 * @param values
 * @param ordinal
 * @param axis
 * @returns {number}
 */
stats.moment = function (values, ordinal = 1, axis = 0) {
    let sum = 0;
    _.forEach(values, value => {
        sum += Math.pow((value - axis), ordinal);
    });
    return sum / values.length;
};

// TODO: ParetoDistribution class

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
 * Compute Pearson Median Skewness
 * @description a robust skewness statistic (less susceptible to outliers)
 * @param values
 * @returns {number}
 */
stats.pearsonMedianSkewness = function (values) {
    const mean = this.mean(values);
    const median = this.median(values);
    const stdev = this.standardDeviation(values);
    return 3 * (mean - median) / stdev;
};

/**
 * Probability Mass Function class
 * @type {exports.ProbabilityMassFunction}
 */
stats.ProbabilityMassFunction = class {
    /**
     * Constructor
     * @param [probabilityMap]
     * @param [values]
     * @param options
     */
    constructor({ probabilityMap, values }, options) {
        this.probabilityMap = probabilityMap;
        this.values = values;

        // compute probability map if not provided
        if (!this.probabilityMap) {
            const histogram = new stats.Histogram({ values: this.values });
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
     * Generate CMF from this PMF by computing its integral
     * @returns {CumulativeMassFunction}
     */
    toCumulativeMassFunction() {
        const probabilityMap = {};
        let sum = 0;
        _.forEach(this.probabilityMap, (prob, value) => {
            sum = _.round(sum + prob, 15); // to prevent binary computation inaccuracies
            probabilityMap[value] = sum;
        });
        return new stats.CumulativeMassFunction({ probabilityMap, values: this.values });
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
 * Generates a random number between the inclusive lower and upper bounds
 * @param lower
 * @param upper
 * @param floating
 * @returns {number}
 */
stats.random = function (lower, upper, floating) {
    return _.random(lower, upper, floating);
};

/**
 * Compute moment about the origin
 * @param values
 * @param ordinal
 * @returns {number}
 */
stats.rawMoment = function (values, ordinal) {
    return this.moment(values, ordinal);
};

/**
 * Compute skewness
 * @description 3rd standardized moment, negative = skews left, positive = skews right
 * @param values
 * @returns {number}
 */
stats.skewness = function (values) {
    return this.standardizedMoment(values, 3);
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
 * Compute standardized moment
 * @description central moment that has been normalize so it has no units
 * @param values
 * @param ordinal
 * @returns {number}
 */
stats.standardizedMoment = function (values, ordinal) {
    const stdev = this.standardDeviation(values);
    return this.centralMoment(values, ordinal) / Math.pow(stdev, ordinal);
};

/**
 * Compute variance
 * @param values
 * @returns {number}
 */
stats.variance = function (values) {
    return this.centralMoment(values, 2);
};

/**
 * Alias of {@link variance}
 * @type {exports.variance|*}
 */
stats.var = stats.variance;
