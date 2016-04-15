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

var iotAgentLib = require('iotagent-node-lib'),
    logger = require('logops'),
    async = require('async'),
    fs = require('fs'),
    path = require('path'),
    context = {
        op: 'IoTA-UL20.Agent'
    },
    config,
    transportBindings = [];

/**
 * Start all the transport protocol bindings found in the bindings directory.
 *
 * @param {Object} newConfig        Configuration object to start the bindings
 */
function startTransportBindings(newConfig, callback) {
    function invokeBinding(binding, callback) {
        binding.start(newConfig, callback);
    }

    var bindings = fs.readdirSync(path.join(__dirname, './bindings'));

    transportBindings = bindings.map(function(item) {
        return require('./bindings/' + item);
    });

    async.map(transportBindings, invokeBinding, callback);
}

/**
 * Stop all the transport protocol bindings of the agent.
 */
function stopTransportBindings(callback) {
    function invokeBinding(binding, callback) {
        binding.stop(callback);
    }

    async.map(transportBindings, invokeBinding, callback);
}

/**
 * Execute the function given by the 'functionName' parameter for all the transport bindings, with the arguments
 * fiven in the 'argument' array
 *
 * @param {Array} argument          Array of arguments to call the function with.
 * @param {String} functionName     Name of the function to call in every transport plugin.
 */
function applyFunctionFromBinding(argument, functionName, callback) {
    function addHandler(current, binding) {
        if (binding[functionName]) {
            var args = [binding[functionName]].concat(argument),
                boundFunction = binding[functionName].bind.apply(binding[functionName], args);

            current.push(boundFunction);
        }

        return current;
    }

    async.series(transportBindings.reduce(addHandler, []), callback);
}

/**
 * Calls all the device provisioning handlers for each transport protocol binding whenever a new device is provisioned
 * in the Agent.
 *
 * @param {Object} device           Device provisioning information.
 */
function deviceProvisioningHandler(device, callback) {
    applyFunctionFromBinding([device], 'deviceProvisioningHandler', callback);
}

/**
 * Calls all the configuration provisioning handlers for each transport protocol binding whenever a new configuration
 * is provisioned in the Agent.
 *
 * @param {Object} configuration     Configuration provisioning information.
 */
function configurationHandler(configuration, callback) {
    applyFunctionFromBinding([configuration], 'configurationHandler', callback);
}

/**
 * Calls all the command execution handlers for each transport protocol binding whenever a new command execution request
 * arrives from the Context Broker.
 **
 * @param {String} id               ID of the entity for which the command execution was issued.
 * @param {String} type             Type of the entity for which the command execution was issued.
 * @param {Array} attributes        List of NGSI attributes of type command to execute.
 */
function commandHandler(id, type, attributes, callback) {
    applyFunctionFromBinding([id, type, attributes], 'commandHandler', callback);
}

/**
 * Handles incoming updateContext requests related with lazy attributes. This handler is still just registered,
 * but empty.
 *
 * @param {String} id               ID of the entity for which the update was issued.
 * @param {String} type             Type of the entity for which the update was issued.
 * @param {Array} attributes        List of NGSI attributes to update.
 */
function updateHandler(id, type, attributes, callback) {
    callback();
}

/**
 * Starts the IOTA with the given configuration.
 *
 * @param {Object} newConfig        New configuration object.
 */
function start(newConfig, callback) {
    var options = {
        keepalive: 0,
        connectTimeout: 60 * 60 * 1000
    };

    config = newConfig;

    if (config.mqtt.username && config.mqtt.password) {
        options.username = config.mqtt.username;
        options.password = config.mqtt.password;
    }

    iotAgentLib.activate(config.iota, function(error) {
        if (error) {
            callback(error);
        } else {
            logger.info(context, 'IoT Agent services activated');

            iotAgentLib.setProvisioningHandler(deviceProvisioningHandler);
            iotAgentLib.setConfigurationHandler(configurationHandler);
            iotAgentLib.setCommandHandler(commandHandler);
            iotAgentLib.setDataUpdateHandler(updateHandler);

            iotAgentLib.addUpdateMiddleware(iotAgentLib.dataPlugins.attributeAlias.update);

            startTransportBindings(newConfig, callback);
        }
    });
}

/**
 * Stops the current IoT Agent.
 *
 */
function stop(callback) {
    logger.info(context, 'Stopping IoT Agent: ');
    async.series([
        stopTransportBindings,
        iotAgentLib.resetMiddlewares,
        iotAgentLib.deactivate
    ], function() {
        logger.info('Agent stopped');
        callback();
    });
}

exports.start = start;
exports.stop = stop;