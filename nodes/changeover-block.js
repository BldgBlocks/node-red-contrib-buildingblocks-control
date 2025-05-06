module.exports = function(RED) {
    function ChangeoverBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "changeover";
        node.setpoint = parseFloat(config.setpoint) || 22;
        node.anticipator = parseFloat(config.anticipator) || 0.5;
        node.deadband = parseFloat(config.deadband) || 2;
        node.swapTime = parseFloat(config.swapTime) || 300;
        node.minTempSetpoint = parseFloat(config.minTempSetpoint) || 10;
        node.maxTempSetpoint = parseFloat(config.maxTempSetpoint) || 30;
        node.minCycleTime = parseFloat(config.minCycleTime) || 60;
        node.enable = config.enable !== false;

        // Validate initial config
        if (isNaN(node.setpoint) || node.setpoint < node.minTempSetpoint || node.setpoint > node.maxTempSetpoint) {
            node.setpoint = 22;
            node.status({ fill: "red", shape: "ring", text: "invalid setpoint" });
        }
        if (isNaN(node.anticipator) || node.anticipator < 0) {
            node.anticipator = 0.5;
            node.status({ fill: "red", shape: "ring", text: "invalid anticipator" });
        }
        if (isNaN(node.deadband) || node.deadband <= 0) {
            node.deadband = 2;
            node.status({ fill: "red", shape: "ring", text: "invalid deadband" });
        }
        if (isNaN(node.swapTime) || node.swapTime < 0) {
            node.swapTime = 300;
            node.status({ fill: "red", shape: "ring", text: "invalid swapTime" });
        }
        if (isNaN(node.minTempSetpoint) || node.minTempSetpoint >= node.maxTempSetpoint) {
            node.minTempSetpoint = 10;
            node.status({ fill: "red", shape: "ring", text: "invalid minTempSetpoint" });
        }
        if (isNaN(node.maxTempSetpoint) || node.maxTempSetpoint <= node.minTempSetpoint) {
            node.maxTempSetpoint = 30;
            node.status({ fill: "red", shape: "ring", text: "invalid maxTempSetpoint" });
        }
        if (isNaN(node.minCycleTime) || node.minCycleTime < 0) {
            node.minCycleTime = 60;
            node.status({ fill: "red", shape: "ring", text: "invalid minCycleTime" });
        }

        // Initialize state
        let currentMode = "off";
        let isHeating = null;
        let lastModeChange = 0;
        let lastCycleStart = 0;
        let temperature = null;
        let lastInput = null;

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (msg.context) {
                if (!msg.hasOwnProperty("payload")) {
                    node.status({ fill: "red", shape: "ring", text: "missing payload" });
                    if (done) done();
                    return;
                }

                if (msg.context === "enable") {
                    if (typeof msg.payload !== "boolean") {
                        node.status({ fill: "red", shape: "ring", text: "invalid enable" });
                        if (done) done();
                        return;
                    }
                    node.enable = msg.payload;
                    node.status({
                        fill: node.enable ? "green" : "red",
                        shape: "dot",
                        text: node.enable ? "enable set to true" : "disabled"
                    });
                    const outputs = evaluateState();
                    if (outputs) {
                        send(outputs);
                    }
                    if (done) done();
                    return;
                }

                const value = parseFloat(msg.payload);
                if (isNaN(value)) {
                    node.status({ fill: "red", shape: "ring", text: `invalid ${msg.context}` });
                    if (done) done();
                    return;
                }

                switch (msg.context) {
                    case "setpoint":
                        if (value < node.minTempSetpoint || value > node.maxTempSetpoint) {
                            node.status({ fill: "red", shape: "ring", text: "invalid setpoint" });
                            if (done) done();
                            return;
                        }
                        node.setpoint = value;
                        node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        break;
                    case "anticipator":
                        if (value < 0) {
                            node.status({ fill: "red", shape: "ring", text: "invalid anticipator" });
                            if (done) done();
                            return;
                        }
                        node.anticipator = value;
                        node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        break;
                    case "deadband":
                        if (value <= 0) {
                            node.status({ fill: "red", shape: "ring", text: "invalid deadband" });
                            if (done) done();
                            return;
                        }
                        node.deadband = value;
                        node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        break;
                    case "swapTime":
                        if (value < 0) {
                            node.status({ fill: "red", shape: "ring", text: "invalid swapTime" });
                            if (done) done();
                            return;
                        }
                        node.swapTime = value;
                        node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        break;
                    case "minTempSetpoint":
                        if (value >= node.maxTempSetpoint) {
                            node.status({ fill: "red", shape: "ring", text: "invalid minTempSetpoint" });
                            if (done) done();
                            return;
                        }
                        node.minTempSetpoint = value;
                        if (node.setpoint < node.minTempSetpoint) {
                            node.setpoint = node.minTempSetpoint;
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: `${msg.context} set to ${value.toFixed(2)}, setpoint adjusted to ${node.setpoint.toFixed(2)}`
                            });
                        } else {
                            node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        }
                        break;
                    case "maxTempSetpoint":
                        if (value <= node.minTempSetpoint) {
                            node.status({ fill: "red", shape: "ring", text: "invalid maxTempSetpoint" });
                            if (done) done();
                            return;
                        }
                        node.maxTempSetpoint = value;
                        if (node.setpoint > node.maxTempSetpoint) {
                            node.setpoint = node.maxTempSetpoint;
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: `${msg.context} set to ${value.toFixed(2)}, setpoint adjusted to ${node.setpoint.toFixed(2)}`
                            });
                        } else {
                            node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        }
                        break;
                    case "minCycleTime":
                        if (value < 0) {
                            node.status({ fill: "red", shape: "ring", text: "invalid minCycleTime" });
                            if (done) done();
                            return;
                        }
                        node.minCycleTime = value;
                        node.status({ fill: "green", shape: "dot", text: `${msg.context} set to ${value.toFixed(2)}` });
                        break;
                    default:
                        node.status({ fill: "yellow", shape: "ring", text: "unknown context" });
                        if (done) done();
                        return;
                }
                const outputs = evaluateState();
                if (outputs) {
                    send(outputs);
                }
                if (done) done();
                return;
            }

            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing temperature" });
                if (done) done();
                return;
            }

            const input = parseFloat(msg.payload);
            if (isNaN(input)) {
                node.status({ fill: "red", shape: "ring", text: "invalid temperature" });
                if (done) done();
                return;
            }

            // Check if input has changed
            if (lastInput !== input) {
                temperature = input;
                lastInput = input;
                const outputs = evaluateState();
                if (outputs) {
                    send(outputs);
                }
            } else {
                updateStatus();
            }

            if (done) done();
            return;

            function evaluateState() {
                if (!node.enable) {
                    if (currentMode !== "off") {
                        currentMode = "off";
                        isHeating = null;
                        updateStatus();
                        return [
                            { payload: isHeating },
                            {
                                payload: {
                                    mode: currentMode,
                                    isHeating,
                                    setpoint: node.setpoint,
                                    temperature,
                                    enabled: node.enable
                                }
                            }
                        ];
                    }
                    updateStatus();
                    return null;
                }

                let now = Date.now() / 1000; // Seconds
                let canSwitchMode = now - lastModeChange >= node.swapTime;
                let canTurnOff = now - lastCycleStart >= node.minCycleTime;

                let heatingThreshold = node.setpoint - node.deadband / 2 - node.anticipator;
                let coolingThreshold = node.setpoint + node.deadband / 2 + node.anticipator;

                let newMode = currentMode;
                let newIsHeating = isHeating;

                if (temperature < heatingThreshold && canSwitchMode) {
                    newMode = "heating";
                    newIsHeating = true;
                } else if (temperature > coolingThreshold && canSwitchMode) {
                    newMode = "cooling";
                    newIsHeating = false;
                } else if (canTurnOff && temperature >= heatingThreshold && temperature <= coolingThreshold) {
                    newMode = "off";
                    newIsHeating = null;
                }

                if (newMode !== currentMode) {
                    lastModeChange = now;
                    if (newIsHeating !== null) {
                        lastCycleStart = now;
                    }
                    currentMode = newMode;
                    isHeating = newIsHeating;
                    updateStatus();
                    return [
                        { payload: isHeating },
                        {
                            payload: {
                                mode: currentMode,
                                isHeating,
                                setpoint: node.setpoint,
                                temperature,
                                enabled: node.enable
                            }
                        }
                    ];
                }

                updateStatus();
                return null;
            }

            function updateStatus() {
                if (!node.enable) {
                    node.status({ fill: "red", shape: "dot", text: "disabled" });
                } else {
                    node.status({
                        fill: "blue",
                        shape: lastInput === temperature && currentMode === evaluateStateMode() ? "ring" : "dot",
                        text: `mode: ${currentMode}, isHeating: ${isHeating === null ? "null" : isHeating}`
                    });
                }

                function evaluateStateMode() {
                    if (!node.enable) return "off";
                    let now = Date.now() / 1000;
                    let canSwitchMode = now - lastModeChange >= node.swapTime;
                    let canTurnOff = now - lastCycleStart >= node.minCycleTime;
                    let heatingThreshold = node.setpoint - node.deadband / 2 - node.anticipator;
                    let coolingThreshold = node.setpoint + node.deadband / 2 + node.anticipator;

                    if (temperature < heatingThreshold && canSwitchMode) return "heating";
                    if (temperature > coolingThreshold && canSwitchMode) return "cooling";
                    if (canTurnOff && temperature >= heatingThreshold && temperature <= coolingThreshold) return "off";
                    return currentMode;
                }
            }
        });

        node.on("close", function(done) {
            // Reset properties to config values on redeployment
            node.setpoint = parseFloat(config.setpoint) || 22;
            node.anticipator = parseFloat(config.anticipator) || 0.5;
            node.deadband = parseFloat(config.deadband) || 2;
            node.swapTime = parseFloat(config.swapTime) || 300;
            node.minTempSetpoint = parseFloat(config.minTempSetpoint) || 10;
            node.maxTempSetpoint = parseFloat(config.maxTempSetpoint) || 30;
            node.minCycleTime = parseFloat(config.minCycleTime) || 60;
            node.enable = config.enable !== false;

            if (isNaN(node.setpoint) || node.setpoint < node.minTempSetpoint || node.setpoint > node.maxTempSetpoint) {
                node.setpoint = 22;
            }
            if (isNaN(node.anticipator) || node.anticipator < 0) {
                node.anticipator = 0.5;
            }
            if (isNaN(node.deadband) || node.deadband <= 0) {
                node.deadband = 2;
            }
            if (isNaN(node.swapTime) || node.swapTime < 0) {
                node.swapTime = 300;
            }
            if (isNaN(node.minTempSetpoint) || node.minTempSetpoint >= node.maxTempSetpoint) {
                node.minTempSetpoint = 10;
            }
            if (isNaN(node.maxTempSetpoint) || node.maxTempSetpoint <= node.minTempSetpoint) {
                node.maxTempSetpoint = 30;
            }
            if (isNaN(node.minCycleTime) || node.minCycleTime < 0) {
                node.minCycleTime = 60;
            }

            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("changeover-block", ChangeoverBlockNode);

    // Serve dynamic config from runtime
    RED.httpAdmin.get("/changeover-block/:id", RED.auth.needsPermission("changeover-block.read"), function(req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "changeover-block") {
            res.json({
                name: node.name || "changeover",
                setpoint: !isNaN(node.setpoint) ? node.setpoint : 22,
                anticipator: !isNaN(node.anticipator) && node.anticipator >= 0 ? node.anticipator : 0.5,
                deadband: !isNaN(node.deadband) && node.deadband > 0 ? node.deadband : 2,
                swapTime: !isNaN(node.swapTime) && node.swapTime >= 0 ? node.swapTime : 300,
                minTempSetpoint: !isNaN(node.minTempSetpoint) ? node.minTempSetpoint : 10,
                maxTempSetpoint: !isNaN(node.maxTempSetpoint) ? node.maxTempSetpoint : 30,
                minCycleTime: !isNaN(node.minCycleTime) && node.minCycleTime >= 0 ? node.minCycleTime : 60,
                enable: node.enable === true
            });
        } else {
            res.status(404).json({ error: "Node not found" });
        }
    });
};