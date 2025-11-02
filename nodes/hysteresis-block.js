module.exports = function(RED) {
    function HysteresisBlockNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store typed-input properties
        node.upperLimit = config.upperLimit;
        node.upperLimitType = config.upperLimitType;
        node.lowerLimit = config.lowerLimit;
        node.lowerLimitType = config.lowerLimitType;
        node.upperLimitThreshold = config.upperLimitThreshold;
        node.upperLimitThresholdType = config.upperLimitThresholdType;
        node.lowerLimitThreshold = config.lowerLimitThreshold;
        node.lowerLimitThresholdType = config.lowerLimitThresholdType;
        node.name = config.name;

        // Initialize runtime state
        node.runtime = {
            name: config.name || "",
            upperLimit: config.upperLimit || 50,
            lowerLimit: config.lowerLimit || 30,
            upperLimitThreshold: config.upperLimitThreshold || 2,
            lowerLimitThreshold: config.lowerLimitThreshold || 2,
            state: "within"
        };

        node.on("input", function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };

            if (!msg) {
                node.status({ fill: "red", shape: "ring", text: "invalid message" });
                if (done) done();
                return;
            }

            // Evaluate all properties
            try {
                node.runtime.upperLimit = RED.util.evaluateNodeProperty(
                    node.upperLimit, node.upperLimitType, node, msg
                );
                node.runtime.lowerLimit = RED.util.evaluateNodeProperty(
                    node.lowerLimit, node.lowerLimitType, node, msg
                );
                node.runtime.upperLimitThreshold = RED.util.evaluateNodeProperty(
                    node.upperLimitThreshold, node.upperLimitThresholdType, node, msg
                );
                node.runtime.lowerLimitThreshold = RED.util.evaluateNodeProperty(
                    node.lowerLimitThreshold, node.lowerLimitThresholdType, node, msg
                );
                
                // Validate values
                if (isNaN(node.runtime.upperLimit) || isNaN(node.runtime.lowerLimit) || 
                    isNaN(node.runtime.upperLimitThreshold) || isNaN(node.runtime.lowerLimitThreshold) ||
                    node.runtime.upperLimit <= node.runtime.lowerLimit ||
                    node.runtime.upperLimitThreshold < 0 || node.runtime.lowerLimitThreshold < 0) {
                    node.status({ fill: "red", shape: "ring", text: "invalid evaluated values" });
                }
            } catch(err) {
                node.status({ fill: "red", shape: "ring", text: "error evaluating properties" });
                if (done) done(err);
                return;
            }

            if (msg.hasOwnProperty("context")) {
                if (msg.context === "upperLimitThreshold") {
                    const value = parseFloat(msg.payload);
                    if (!isNaN(value) && value >= 0) {
                        node.runtime.upperLimitThreshold = value;
                        node.status({ fill: "green", shape: "dot", text: `upperLimitThreshold: ${value}` });
                    }
                } else if (msg.context === "lowerLimitThreshold") {
                    const value = parseFloat(msg.payload);
                    if (!isNaN(value) && value >= 0) {
                        node.runtime.lowerLimitThreshold = value;
                        node.status({ fill: "green", shape: "dot", text: `lowerLimitThreshold: ${value}` });
                    }
                }
                if (done) done();
                return;
            }

            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing payload" });
                if (done) done();
                return;
            }
            const inputValue = parseFloat(msg.payload);
            if (isNaN(inputValue)) {
                node.status({ fill: "red", shape: "ring", text: "invalid payload" });
                if (done) done();
                return;
            }

            // Calculate all boundary points - ensure numeric values
            const upperTurnOn = node.runtime.upperLimit;
            const upperTurnOff = node.runtime.upperLimit - node.runtime.upperLimitThreshold;
            const lowerTurnOn = node.runtime.lowerLimit;
            const lowerTurnOff = node.runtime.lowerLimit + node.runtime.lowerLimitThreshold;

            // Add validation to ensure numbers
            if (isNaN(upperTurnOn) || isNaN(upperTurnOff) || isNaN(lowerTurnOn) || isNaN(lowerTurnOff)) {
                node.status({ fill: "red", shape: "ring", text: "invalid boundary calculation" });
                if (done) done();
                return;
            }
            // Apply comprehensive hysteresis logic
            let newState = node.runtime.state;

            switch (node.runtime.state) {
                case "above":
                    if (inputValue <= upperTurnOff) {
                        newState = "within";
                        if (inputValue <= lowerTurnOn) {
                            newState = "below"; 
                        }
                    }
                    break;
            
                case "below":
                    if (inputValue >= lowerTurnOff) {
                        newState = "within";
                        if (inputValue >= upperTurnOn) {
                            newState = "above";
                        }
                    }
                    break;
            
                case "within":
                    if (inputValue >= upperTurnOn) {
                        newState = "above";
                    } else if (inputValue <= lowerTurnOn) {
                        newState = "below";
                    }
                    break;
                }
            

            const output = [
                { payload: newState === "above" },
                { payload: newState === "within" },
                { payload: newState === "below" }
            ];

            node.status({
                fill: "blue",
                shape: "dot",
                text: `in: ${inputValue.toFixed(2)}, state: ${newState}`
            });

            node.runtime.state = newState;
            send(output);

            if (done) done();
        });

        node.on("close", function(done) {
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("hysteresis-block", HysteresisBlockNode);
};
