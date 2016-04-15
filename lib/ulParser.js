/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * iotagent-ul is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-ul is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-ul.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 */

'use strict';

var errors = require('./errors'),
    _ = require('underscore');

/**
 * Generates a function that parse the given attribute string, adding it to the previous collection, using the
 * provided separator.
 *
 * @param {String} separator           Character used to separate the key from the value
 * @return {Function}                  The key-pair parsing function for the separator.
 */
function addAttribute(separator) {
    return function(collection, newAttr) {
        var fields = newAttr.split(separator);

        if (!fields || fields.length !== 2) {
            throw new errors.ParseError('Extracting attribute:' + newAttr);
        } else {
            collection[fields[0]] = fields[1];
            return collection;
        }
    };
}

/**
 * Extract a key value pair from a length 2 array and add it as an attribute to the given object.
 *
 * @param {Object} collection          Collection of key value pairs
 * @param {Array} pair                 Key value pair as an array of length 2.
 * @return {Object}                    Resulting object.
 */
function addAttributePair(collection, pair) {
    if (!pair || pair.length !== 2) {
        throw new errors.ParseError('Extracting attribute:' + JSON.stringify(pair));
    } else {
        collection[pair[0]] = pair[1];
        return collection;
    }
}

/**
 * Divide a list into smaller chunks, of the given size.
 *
 * @param {Array}  list         Array to be divided.
 * @param {Number} size         Size of the chunks.
 * @return {Array}              Array containing the chunks.
 */
function chunk(list, size) {
    var chunks = [];

    while (list.length) {
        chunks.push(list.splice(0, size));
    }

    return chunks;
}

/**
 * Parse a measure group, i.e.: a string of key-value pairs sepparated by the '|' character, returning an object with
 * the same information structured as a map.
 *
 * @param {String} group                String containing a UL2.0 codified group.
 * @return {Object}                    Object representing the information in the group.
 */
function parseGroup(group) {
    var attributes = group.split('|');

    if (!attributes || attributes.length === 0 ||
        attributes.length % 2 !== 0 || attributes.filter(_.isEmpty).length > 0) {
        throw new errors.ParseError('Parsing group:' + group);
    } else {
        return chunk(attributes, 2).reduce(addAttributePair, {});
    }
}

/**
 * Parse a measure reporting payload, returning an array with all the measure groups restructured as objects. Throws
 * an error if the syntax is not correct.
 *
 * @param {String} payload          Ultralight 2.0 measure reporting payload
 * @return {Array}                 Array containing an object per measure group
 */
function parse(payload) {
    var groups = payload.split('#');

    return groups.map(parseGroup);
}

/**
 * Parse a command execution payload, returning an object containing information about the command. Throws
 * an error if the syntax is not correct.
 *
 * The returned object contains three attributes:
 * - deviceId: ID of the device executing the command.
 * - command: name of the command to execute.
 * - params: object containing the parameters to the command in map format.
 *
 * @param {String} payload          Ultralight 2.0 command execution payload
 * @return {Object}                Object containing the command information
 */
function command(payload) {
    var fields = payload.split('|'),
        deviceData,
        commandData;

    if ((fields.length < 1) || (fields[0].indexOf('@') < 0)) {
        throw new errors.ParseError('Parsing command:' + payload);
    }

    deviceData = fields[0].split('@');
    commandData = fields.splice(1).reduce(addAttribute('='), {});

    return {
        deviceId: deviceData[0],
        command: deviceData[1],
        params: commandData
    };
}

/**
 * Parse a command result payload, returning an object containing information about the command result. Throws
 * an error if the syntax is not correct.
 *
 * The returned object contains three attributes:
 * - deviceId: ID of the device executing the command.
 * - command: name of the command to execute.
 * - result: a string representing the output of the command.
 *
 * @param {String} payload          Ultralight 2.0 command result payload
 * @return {Object}                Object containing the result information
 */
function result(payload) {
    var fields = payload.split('|'),
        deviceData;

    if ((fields.length < 1) || (fields[0].indexOf('@') < 0)) {
        throw new errors.ParseError('Parsing command:' + payload);
    }

    deviceData = fields[0].split('@');

    return {
        deviceId: deviceData[0],
        command: deviceData[1],
        result: fields[1]
    };
}

exports.parse = parse;
exports.command = command;
exports.result = result;