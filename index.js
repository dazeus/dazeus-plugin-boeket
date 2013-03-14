#!/usr/bin/env node
var generator = require('agfl-generate');
var fs = require('fs');
var dazeus = require('dazeus');
var _ = require('underscore');
var util = require('util');

// constants
var BOEKET = 'boeket';
var TXT_OK = 'Goed om te weten!';
var TXT_IGNORE = 'Ik mag van %s geen verhaaltjes vertellen.';

var BOEKET_FILE = './data/boeket.txt';
var LADIES_FILE = './data/ladies.txt';
var IGNORES_FILE = './data/ignores.txt';
var IRC_MAX_LENGTH = 400;
var DEFAULT_FEMALE = 'Ingrid';
var DEFAULT_MALE = 'Henk';

// read arguments
var argv = dazeus.optimist().argv;
dazeus.help(argv);
var options = dazeus.optionsFromArgv(argv);

// load grammar
var boeketGrammar = fs.readFileSync(BOEKET_FILE).toString();
var grammar = generator.parse(boeketGrammar);

/**
 * Gets an example line from the grammar and splits it according to IRC_MAX_LENGTH
 * @return {Array} List of strings
 */
var getExampleLines = function (w, m, ma, wa, random, gender) {
    var joiner = function (value, isTerminal) {
        if (isTerminal && value !== '.' && value !== ',') {
            return ' ' + value;
        } else {
            return value;
        }
    };

    var example = "";
    if (random) {
        example = generator.generateExample(grammar, joiner, grammar.root);
    } else {
        example = generator.generateExample(grammar, joiner, 'boeket_about', [gender, 'zeven']);
    }
    example = example.replace(/\$\{man\}/g, typeof m === 'undefined' || m === null ? DEFAULT_MALE : m);
    example = example.replace(/\$\{vrouw\}/g, typeof w === 'undefined' || w === null ? DEFAULT_FEMALE : w);
    example = example.replace(/\$\{manbij\}/g, typeof ma === 'undefined' || ma === null ? DEFAULT_MALE : ma);
    example = example.replace(/\$\{vrouwbij\}/g, typeof wa === 'undefined' || wa === null ? DEFAULT_FEMALE : wa);
    example = example.trim().split('.');

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

var generateStory = function (client, network, channel, user, about) {
    var cb = function (names) {
        var femaleOpts = dazeus.readFile(LADIES_FILE);
        var ignoreOpts = dazeus.readFile(IGNORES_FILE);
        var gentlemen = _(names).filter(function (name) {
            return !_(femaleOpts).contains(name) && !_(ignoreOpts).contains(name);
        });
        var ladies = _(names).filter(function (name) {
            return _(femaleOpts).contains(name) && !_(ignoreOpts).contains(name);
        });

        if (_(ignoreOpts).contains(about)) {
            client.reply(network, channel, user, util.format(TXT_IGNORE, about), false);
        } else {
            var randomLady = ladies[Math.floor(Math.random() * ladies.length)];
            var randomGentleman = gentlemen[Math.floor(Math.random() * gentlemen.length)];
            var isReallyRandom = true;
            var aboutGender = null;
            if (typeof about === 'string') {
                isReallyRandom = false;
                if (_(ladies).contains(about)) {
                    randomLady = about;
                    aboutGender = 'v';
                } else {
                    randomGentleman = about;
                    aboutGender = 'm';
                }
            }

            var lines = getExampleLines(
                randomLady,
                randomGentleman,
                ladies[Math.floor(Math.random() * ladies.length)],
                gentlemen[Math.floor(Math.random() * gentlemen.length)],
                isReallyRandom,
                aboutGender
            );
            for (var i = 0; i < lines.length; i += 1) {
                client.reply(network, channel, user, lines[i], false);
            }
        }
    };
    client.nick(network, function (answer) {
        if (channel === answer.nick) {
            cb([user, answer.nick]);
        } else {
            client.nicknames(network, channel, cb);
        }
    });
};

var removeFrom = function (file, who) {
    dazeus.removeFrom(file, who);
};

var addTo = function (file, who) {
    dazeus.appendTo(file, who);
};

// connect to dazeus
var client = dazeus.connect(options, function () {
    client.onCommand(BOEKET, function (network, user, channel, command, args) {
        dazeus.isCommand(['$', 'is', 'man'], args, function (name) {
            removeFrom(IGNORES_FILE, name);
            removeFrom(LADIES_FILE, name);
            client.reply(network, channel, user, TXT_OK, false);
        }, function () {
            dazeus.isCommand(['$', 'is', 'niets'], args, function (name) {
                addTo(IGNORES_FILE, name);
                removeFrom(LADIES_FILE, name);
                client.reply(network, channel, user, TXT_OK, false);
            }, function () {
                dazeus.isCommand(['$','is','vrouw'], args, function (name) {
                    addTo(LADIES_FILE, name);
                    removeFrom(IGNORES_FILE, name);
                    client.reply(network, channel, user, TXT_OK, false);
                }, function () {
                    dazeus.isCommand(['$', 'is', 'geen', 'vrouw'], args, function (name) {
                        removeFrom(LADIES_FILE, name);
                        client.reply(network, channel, user, TXT_OK, false);
                    }, function () {
                        dazeus.isCommand(['over', '$'], args, function (name) {
                            generateStory(client, network, channel, user, name);
                        }, function () {
                            generateStory(client, network, channel, user);
                        });
                    });
                });
            });
        });
    });
});
