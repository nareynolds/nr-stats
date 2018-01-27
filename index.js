"use strict";

const _ = require('lodash');

const stats = module.exports = {};

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
     * @param values
     * @param frequencyMap
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
     * @returns {*}
     */
    frequency(value) {
        return this.frequencyMap[value];
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
        if (!value) hist[value] = 0;
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
 * Compute mode
 * @param values
 * @returns {number}
 */
stats.mode = function (values) {
    const max = _.max(values);
    const hist = this.historgram(values);
    return hist[_.toString(max)];
};

/**
 * Compute percentile rank
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
 * @param values
 * @param percentileRank
 * @returns {number}
 */
stats.percentile = function (values, percentileRank) {
    values = _.sort(values);
    const index = percentileRank * (values.length - 1);
    return values[index];
};

/**
 * Probability mass function class
 * @type {exports.ProbabilityMassFunction}
 */
stats.ProbabilityMassFunction = class {
    /**
     * Constructor
     * @param values
     * @param probabilityMap
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
        if (options.familySizeBias) {
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
     * Get mean
     * @returns {number}
     */
    get mean() {
        // cache mean
        if (_.isNil(this._mean)) {
            if (this.values) {
                // compute from values if provided
                this._mean = stats.mean(this.values);
            } else {
                // compute from probability distribution
                let mean = 0;
                _.forEach(this.probabilityMap, (prob, value) => {
                    mean += prob * value;
                });
                this._mean = mean;
            }
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
        _.forEach(this.probabilityMap, (prob, key) => {
            this.probabilityMap[key] = prob / total;
        });
    }

    /**
     * Get probability for given value
     * @param value
     * @returns {*}
     */
    probability(value) {
        return this.probabilityMap(value);
    }

    /**
     * Get standard deviation
     * @returns {number}
     */
    get standardDeviation() {
        // cache stdev
        if (_.isNil(this._standardDeviation)) {
            if (this.values) {
                // compute from values if provided
                this._standardDeviation = stats.standardDeviation(this.values);
            } else {
                // compute from probability distribution
                this._standardDeviation = Math.sqrt(this.variance);
            }
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
     * Get variance
     * @returns {number}
     */
    get variance() {
        // cache variance
        if (_.isNil(this._variance)) {
            if (this.values) {
                // compute from values if provided
                this._variance = stats.variance(this.values);
            } else {
                // compute from probability distribution
                let variance = 0;
                _.forEach(this.probabilityMap, (prob, value) => {
                    variance += prob * Math.pow((value - this.mean), 2);
                });
                this._variance = variance;
            }
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

