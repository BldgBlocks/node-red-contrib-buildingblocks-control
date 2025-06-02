module.exports = function(RED) {
    function ChartDataReceiverNode(config) {
        RED.nodes.createNode(this, config);
        this.chartConfig = RED.nodes.getNode(config.chartConfig);
        this.seriesName = config.seriesName;
        this.storageType = config.storageType || 'memory';
        const node = this;

        node.on('input', function(msg) {
            node.log(`Received msg: ${JSON.stringify(msg)}`);
            if (!node.chartConfig) {
                node.error("No chart configuration defined");
                return;
            }
            if (!node.seriesName) {
                node.error("No series name selected");
                return;
            }

            const payloadValue = parseFloat(msg.payload);
            if (isNaN(payloadValue)) {
                node.warn(`Invalid payload: ${msg.payload}`);
                return;
            }

            const bucket = node.chartConfig.name || 'default';
            const now = Math.floor(Date.now() / 1000); // Seconds
            const dataPoint = { timestamp: now, value: payloadValue };

            if (this.storageType === 'memory') {
                // In-memory storage (unchanged)
                const contextKey = `chart_data_${bucket}`;
                let bucketData = node.context().flow.get(contextKey) || {};
                if (!bucketData[node.seriesName]) {
                    bucketData[node.seriesName] = [];
                }
                bucketData[node.seriesName].push(dataPoint);

                const maxMemoryBytes = (node.chartConfig.maxMemoryMb || 10) * 1024 * 1024;
                let totalSize = Buffer.byteLength(JSON.stringify(bucketData), 'utf8');
                while (totalSize > maxMemoryBytes && Object.keys(bucketData).length > 0) {
                    let oldestSeries = Object.keys(bucketData)[0];
                    bucketData[oldestSeries].shift();
                    if (bucketData[oldestSeries].length === 0) {
                        delete bucketData[oldestSeries];
                    }
                    totalSize = Buffer.byteLength(JSON.stringify(bucketData), 'utf8');
                }

                node.context().flow.set(contextKey, bucketData);
                node.log(`Stored data for ${bucket}/${node.seriesName}: ${JSON.stringify(dataPoint)}`);
            } else if (this.storageType === 'influxdb') {
                // InfluxDB output (HTTP-based, no config node)
                msg.payload = [{
                    measurement: 'sensor_data',
                    tags: {
                        bucket: bucket,
                        seriesName: node.seriesName
                    },
                    fields: {
                        value: payloadValue
                    },
                    timestamp: now * 1e9 // Nanoseconds
                }];
                node.send(msg);
                node.log(`Prepared InfluxDB point for ${bucket}/${node.seriesName}: ${JSON.stringify(msg.payload)}`);
            } else if (this.storageType === 'custom') {
                // Custom output (unchanged)
                msg.payload = {
                    bucket: bucket,
                    seriesName: node.seriesName,
                    dataPoint: dataPoint
                };
                node.send(msg);
                node.log(`Prepared custom data for ${bucket}/${node.seriesName}: ${JSON.stringify(msg.payload)}`);
            }
        });
    }
    RED.nodes.registerType("chart-data-receiver", ChartDataReceiverNode);
};