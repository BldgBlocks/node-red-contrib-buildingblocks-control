module.exports = function(RED) {
    function InfluxDBQueryNode(config) {
        RED.nodes.createNode(this, config);
        this.influxConfig = RED.nodes.getNode(config.influxConfig);
        this.bucket = config.bucket || 'Furnace';
        this.defaultTimeSpan = parseInt(config.defaultTimeSpan) || 604800;
        this.timeSpanSource = config.timeSpanSource || 'msg.req.query.timeSpan';
        const node = this;

        node.on('input', function(msg) {
            if (!node.influxConfig) {
                node.error("No InfluxDB configuration defined", msg);
                return;
            }

            try {
                const token = node.influxConfig.token;
                if (!token) {
                    node.error("No token provided in InfluxDB configuration", msg);
                    return;
                }

                // Extract timeSpan
                let timeSpan;
                if (node.timeSpanSource === 'msg.timeSpan') {
                    timeSpan = Number.isInteger(parseInt(msg.timeSpan)) ? parseInt(msg.timeSpan) : node.defaultTimeSpan;
                } else if (node.timeSpanSource === 'msg.req.query.timeSpan') {
                    timeSpan = msg.req && msg.req.query && Number.isInteger(parseInt(msg.req.query.timeSpan))
                        ? parseInt(msg.req.query.timeSpan)
                        : node.defaultTimeSpan;
                } else {
                    timeSpan = node.defaultTimeSpan;
                }

                // Ensure timeSpan is positive
                if (timeSpan <= 0) {
                    node.error("Invalid timeSpan: Must be a positive integer", msg);
                    return;
                }

                node.log(`Using timeSpan: ${timeSpan} seconds`);

                // Set msg.bucket and msg.timeSpan
                msg.bucket = node.bucket;
                msg.timeSpan = timeSpan;

                // Build query with quoted seriesName
                const query = `
                    SELECT time, "seriesName", value
                    FROM sensor_data
                    WHERE bucket = '${node.bucket.replace(/'/g, "\\'")}'
                    AND time >= now() - INTERVAL '${timeSpan} SECOND'
                    ORDER BY time
                `;

                // Prepare HTTP request
                const isV3 = node.influxConfig.version === '3';
                const endpoint = isV3 ? '/api/v3/query_sql' : '/api/v2/query';
                msg.url = `http://${node.influxConfig.host}:${node.influxConfig.port}${endpoint}`;
                msg.method = 'POST';
                msg.headers = {
                    'Authorization': isV3 ? `Bearer ${token}` : `Token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                };
                msg.payload = {
                    db: node.influxConfig.database,
                    q: query
                };

                node.log(`Sending query with timeSpan: ${msg.timeSpan}`);
                node.send(msg);
            } catch (e) {
                node.error(`Failed to build query or prepare request: ${e.message}`, msg);
            }
        });
    }
    RED.nodes.registerType("influxdb-query", InfluxDBQueryNode);
};