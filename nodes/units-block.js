module.exports = function (RED) {
    function UnitsBlockNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
        const context = this.context();

        // Initialize configuration
        node.name = config.name || "";
        node.unit = config.unit || "°F";

        // Initialize context
        node.lastUnit = context.get("lastUnit") || node.unit;
        node.lastPayload = context.get("lastPayload") || null;
        context.set("lastUnit", node.lastUnit);
        context.set("lastPayload", node.lastPayload);

        // Validate configuration
        const validUnits = ["°C", "°F", "K", "%RH", "Pa", "kPa", "bar", "mbar", "psi", "atm", "inH₂O", "mmH₂O", "CFM", "m³/h", "L/s", "V", "mV", "A", "mA", "W", "Ω", "%", "m", "cm", "mm", "km", "ft", "in", "kg", "g", "lb", "s", "min", "h", "L", "mL", "gal", "lx", "cd", "B", "T"];
        if (!validUnits.includes(node.unit)) {
            node.status({ fill: "red", shape: "ring", text: "invalid unit" });
            console.log(`invalid configuration for units-block node ${node.id}: unit=${node.unit}`);
            return;
        }

        // Set initial status
        const payloadPreview = node.lastPayload !== null ? (typeof node.lastPayload === "number" ? node.lastPayload.toFixed(2) : JSON.stringify(node.lastPayload)) : "none";
        node.status({
            fill: "blue",
            shape: "dot",
            text: `unit: ${node.lastUnit}, value: ${payloadPreview}`
        });
        console.log(`initialized units-block node ${node.id}: unit=${node.unit}`);

        node.on("input", function (msg, send, done) {
            send = send || function () { node.send.apply(node, arguments); };

            // Validate input
            if (!msg || typeof msg !== "object") {
                node.status({ fill: "red", shape: "ring", text: "missing message" });
                console.log(`error in units-block node ${node.id}: missing message`);
                if (done) done();
                return;
            }

            try {
                // Append msg.units
                const outputMsg = { ...msg, units: node.unit };

                // Check for unchanged output
                const isUnchanged = node.unit === node.lastUnit && JSON.stringify(msg.payload) === JSON.stringify(node.lastPayload);
                node.lastUnit = node.unit;
                node.lastPayload = msg.payload;
                context.set("lastUnit", node.lastUnit);
                context.set("lastPayload", node.lastPayload);

                // Update status
                const payloadPreview = msg.payload !== null ? (typeof msg.payload === "number" ? msg.payload.toFixed(2) : JSON.stringify(msg.payload)) : "none";
                node.status({
                    fill: "blue",
                    shape: isUnchanged ? "ring" : "dot",
                    text: `unit: ${node.unit}, value: ${payloadPreview}`
                });

                // Send output only if changed
                if (!isUnchanged) {
                    send(outputMsg);
                    console.log(`processed units-block node ${node.id}: unit=${node.unit}, payload=${payloadPreview}`);
                } else {
                    console.log(`unchanged output for units-block node ${node.id}: unit=${node.unit}, payload=${payloadPreview}`);
                }

            } catch (error) {
                node.status({ fill: "red", shape: "ring", text: "processing error" });
                console.error(`error in units-block node ${node.id}: ${error.message}`);
                if (done) done(error);
                return;
            }

            if (done) done();
        });

        node.on("close", function (done) {
            node.status({});
            console.log(`closed units-block node ${node.id}`);
            done();
        });
    }

    RED.nodes.registerType("units-block", UnitsBlockNode);

    // HTTP endpoint for editor reflection
    RED.httpAdmin.get("/units-block/:id", RED.auth.needsPermission("units-block.read"), function (req, res) {
        const node = RED.nodes.getNode(req.params.id);
        if (node && node.type === "units-block") {
            res.json({
                name: node.name || "",
                unit: node.unit || "°F"
            });
        } else {
            res.status(404).json({ error: "node not found" });
        }
    });
};