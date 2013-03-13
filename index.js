#!/usr/bin/env node
var generator = require('agfl-generate');
var fs = require('fs');
var dazeus = require('dazeus');

// constants
var BOEKET = 'boeket';

var IRC_MAX_LENGTH = 400;

// read arguments
var argv = dazeus.optimist().argv;
dazeus.help(argv);
var options = dazeus.optionsFromArgv(argv);

// load grammar
var boeketGrammar = fs.readFileSync('./boeket.txt').toString();
var grammar = generator.parse(boeketGrammar);

/**
 * Gets an example line from the grammar and splits it according to IRC_MAX_LENGTH
 * @return {Array} List of strings
 */
var getExampleLines = function () {
    var example = generator.generateExample(grammar, function (value, isTerminal) {
        if (isTerminal && value !== '.' && value !== ',') {
            return ' ' + value;
        } else {
            return value;
        }
    }, grammar.root).trim().split('.');

    var lines = [];

    var currentLine = "";
    while (example.length > 0) {
        var sentence = example.shift();
        if (sentence.length > 0) {
            if (currentLine.length + sentence.length + 1 < IRC_MAX_LENGTH) {
                currentLine += sentence + '.';
            } else {
                lines.push(currentLine.trim());
                currentLine = sentence + '.';
            }
        }
    }
    if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
    }
    return lines;
};

// connect to dazeus
var client = dazeus.connect(options, function () {
    client.onCommand(BOEKET, function (network, user, channel, command) {
        var lines = getExampleLines();
        for (var i = 0; i < lines.length; i += 1) {
            client.reply(network, channel, user, lines[i], false);
        }
    });
});
