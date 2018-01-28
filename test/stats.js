"use strict";

const _ = require('lodash');
const stats = require('../index');
const test = require('tape');

const data = [15.00, 13.50, 18.90, 12.60, 14.60, 9.220, 15.90, 11.60, 12.30, 18.20, 17.50, 15.00, 18.90, 16.30, 14.90, 13.20, 17.80, 14.30, 13.30, 19.60, 13.90, 12.00, 15.50, 17.70, 13.30, 17.70, 17.50, 10.90, 10.90, 13.00, 15.80, 16.40, 13.10, 14.80, 12.70, 16.80, 16.00, 14.10, 13.50, 13.50, 14.20, 16.50, 16.10, 14.60, 18.20, 15.60, 16.50, 12.30, 14.90, 15.80, 19.30, 16.30, 16.10, 13.40, 16.40, 16.00, 12.50, 15.70, 15.90, 15.20, 18.20, 14.10, 14.10, 19.40, 17.90, 13.50, 16.70, 16.30, 12.30, 16.40, 16.30, 16.10, 16.10, 9.940, 14.20, 13.60, 15.20, 12.90, 17.80, 14.40, 10.40, 17.90, 15.60, 14.80, 13.40, 14.10, 19.00, 18.00, 19.30, 16.00, 12.10, 13.40, 15.20, 14.70, 16.10, 16.30, 15.10, 13.70, 15.40, 16.30];

test('CumulativeDistributionFunction', t => {
    t.plan(13);
    let cdf = new stats.CumulativeDistributionFunction({ values: [2, 1, 2, 5, 3] });
    t.equal(cdf.probability(0), 0);
    t.equal(cdf.probability(1), 0.2);
    t.equal(cdf.probability(2), 0.6);
    t.equal(cdf.probability(3), 0.8);
    t.equal(cdf.probability(4), 0.8);
    t.equal(cdf.probability(5), 1);
    t.equal(cdf.value(0.2), 1);
    t.equal(cdf.value(0.6), 2);
    t.equal(cdf.value(0.8), 3);
    t.equal(cdf.value(1), 5);
    cdf = new stats.CumulativeDistributionFunction({ values: [55, 66, 77, 88, 99] });
    t.equal(cdf.percentileRank(88), 80);
    t.equal(cdf.percentile(60), 77);
    t.equal(cdf.interquartileRange, 22);
});

// TODO: effectSize

test('frequency', t => {
    t.plan(1);
    t.equal(stats.frequency(data, 13.50), 4);
});

test('Histogram', t => {
    t.plan(3);
    const hist = new stats.Histogram({ values: data });
    t.equal(hist.frequency(13.50), 4);
    t.equal(hist.mode.value, 16.3);
    t.equal(hist.mode.frequency, 6);
});

test('mean', t => {
    t.plan(1);
    t.equal(stats.mean(data), 15.1546);
});

test('median', t => {
    t.plan(1);
    t.equal(stats.median(data), 15.2);
});

test('mode', t => {
    t.plan(2);
    const mode = stats.mode(data);
    t.equal(mode.value, 16.3);
    t.equal(mode.frequency, 6);
});

test('percentileRank', t => {
    t.plan(1);
    const rank = stats.percentileRank([55, 66, 77, 88, 99], 88);
    t.equal(rank, 80);
});

test('percentile', t => {
    t.plan(1);
    const percentile = stats.percentile([55, 66, 77, 88, 99], 60);
    t.equal(percentile, 77);
});

test('ProbabilityMassFunction', t => {
    t.plan(4);
    const pmf = new stats.ProbabilityMassFunction({ values: data });
    t.equal(pmf.mean, 15.154599999999995);
    t.equal(pmf.probability(16.3), 0.06);
    t.equal(pmf.standardDeviation, 2.217142043262001);
    t.equal(pmf.variance, 4.915718840000001);
});

test('standardDeviation', t => {
    t.plan(1);
    t.equal(stats.standardDeviation(data), 2.217142043262001);
});

test('variance', t => {
    t.plan(1);
    t.equal(stats.variance(data), 4.91571884);
});


