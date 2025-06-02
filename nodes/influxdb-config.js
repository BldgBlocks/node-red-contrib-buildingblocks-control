module.exports = function(RED) {
    function InfluxDBConfigNode(n) {
        RED.nodes.createNode(this, n);
        this.host = n.host;
        this.port = n.port;
        this.database = n.database;
        this.org = n.org;
        this.version = n.version; // '2.x' or '3'
        this.token = n.token;
    }
    RED.nodes.registerType("influxdb-config", InfluxDBConfigNode);
};