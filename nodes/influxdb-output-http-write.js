module.exports = function(RED) {
    function InfluxDBOutputHttpWriteNode(config) {
        RED.nodes.createNode(this, config);
        this.influxConfig = RED.nodes.getNode(config.influxConfig);
        this.tags = config.tags || "";
        const node = this;

        node.on('input', function(msg) {
            if (!node.influxConfig) {
                node.error("No InfluxDB configuration defined", msg);
                return;
            }
            if (!Array.isArray(msg.payload) || !msg.payload[0]?.measurement || !msg.payload[0]?.fields) {
                node.error("Invalid payload: Expected array of {measurement, tags, fields, timestamp}", msg);
                return;
            }

            try {
                const token = node.influxConfig.token;
                if (!token) {
                    node.error("No token provided in InfluxDB configuration", msg);
                    return;
                }

                const extraTags = {};
                if (node.tags) {
                    node.tags.split(',').map(s => s.trim()).filter(tag => tag).forEach((tag, index) => {
                        extraTags[`tag_${index}`] = tag;
                    });
                }

                const lines = msg.payload.map(point => {
                    const { measurement, tags = {}, fields = {}, timestamp } = point;

                    const allTags = { ...tags, ...extraTags };
                    const tagPairs = Object.entries(allTags)
                        .map(([k, v]) => `${k.replace(/[, =]/g, '\\$&')}=${v.toString().replace(/[, =]/g, '\\$&')}`)
                        .join(',');

                    const fieldPairs = Object.entries(fields)
                        .map(([k, v]) => {
                            let val = v;
                            if (typeof v === 'string') val = `"${v.replace(/"/g, '\\"')}"`;
                            else if (typeof v === 'number') val = `${v}`; // Treat all numbers as floats
                            return `${k.replace(/[, =]/g, '\\$&')}=${val}`;
                        })
                        .join(',');

                    let line = `${measurement.replace(/[, ]/g, '\\$&')}`;
                    if (tagPairs) line += `,${tagPairs}`;
                    line += ` ${fieldPairs}`;
                    if (timestamp) line += ` ${timestamp}`;

                    return line;
                });

                node.log(`[${node.id}] Line Protocol: ${lines.join('\n')}`);

                const isV3 = node.influxConfig.version === '3';
                const endpoint = isV3 ? '/api/v3/write_lp' : '/api/v2/write';
                const params = isV3
                    ? `db=${node.influxConfig.database}`
                    : `org=${node.influxConfig.org}&bucket=${node.influxConfig.database}&precision=ns`;
                msg.url = `http://${node.influxConfig.host}:${node.influxConfig.port}${endpoint}?${params}`;
                msg.method = 'POST';
                msg.headers = {
                    'Authorization': isV3 ? `Bearer ${token}` : `Token ${token}`,
                    'Content-Type': 'text/plain'
                };
                msg.payload = lines.join('\n');

                node.send(msg);
            } catch (e) {
                node.error(`Failed to format Line or send request: ${e.message}`, msg);
            }
        });
    }
    RED.nodes.registerType("influxdb-output-http-write", InfluxDBOutputHttpWriteNode);
};