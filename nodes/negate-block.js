module.exports = function(RED) {
    function NegateBlockNode(config) {
        RED.nodes.createNode(this, config);
        
        const node = this;
        
        // Initialize properties from config
        node.name = config.name || "negate";
        
        // Store last input value to check for changes
        let lastInput = null;

        node.on("input", function(msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            if (!msg.hasOwnProperty("payload")) {
                node.status({ fill: "red", shape: "ring", text: "missing payload" });
                if (done) done();
                return;
            }

            const inputValue = msg.payload;
            let outputValue;

            // Handle number input
            if (typeof inputValue === 'number' && !isNaN(inputValue)) {
                outputValue = -inputValue;
            }
            // Handle boolean input
            else if (typeof inputValue === 'boolean') {
                outputValue = !inputValue;
            }
            // Handle invalid inputs
            else {
                let errorText;
                if (inputValue === null) {
                    errorText = "null input";
                } else if (Array.isArray(inputValue)) {
                    errorText = "array input";
                } else if (typeof inputValue === 'string') {
                    errorText = "string input";
                } else {
                    errorText = "invalid input type";
                }
                node.status({ fill: "red", shape: "ring", text: errorText });
                if (done) done();
                return;
            }

            // Check if output value has changed
            if (lastInput !== outputValue) {
                lastInput = outputValue;
                send({ payload: outputValue });

                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: `in: ${inputValue}, out: ${outputValue}`
                });
            } else {
                node.status({
                    fill: "blue",
                    shape: "ring",
                    text: `in: ${inputValue}, out: ${outputValue}`
                });
            }

            if (done) done();
            return;
        });

        node.on("close", function(done) {
            // Clear status to prevent stale status after restart
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("negate-block", NegateBlockNode);
};