"use strict";

var tgos = void 0;
var capaiblity_xml = void 0;
var reading_group = {};
var maker_images = {
    "swcb-sos-new/service": "http://210.65.11.194/TGOS_API/images/marker.png",
    "epa-sos/service": "http://i.imgur.com/XExhkhs.png?2" };

/* 
* Create TGOS map when DOM onloaded;
* 
* @method create_map
* @return void
*/
function create_map() {
    var map_element = document.getElementById("TGMap");
    tgos = new TGOS.TGOnlineMap(map_element, TGOS.TGCoordSys.EPSG3857);
}

/* 
* For saving observations and information of a offering
* 
* @Class Reading
* @constructor {Object} collection of a observation
*/
function Reading(info) {
    this.feature_of_interest = info.feature;
    this.last_time = info.last_time;
    this.last_result = info.last_result;
    this.latitude = info.lower_corner[1];
    this.longitude = info.lower_corner[0];
    this.observations = info.observations || [];
    this.property = info.property;
    this.uom = info.uom;
}

/* 
* Automatically Send GET request to SOS when select a offering
* 
* @method get_capability
* @param {String} Url of the SOS
* @return void
*/
function get_capability(url) {
    var xmlhttp = create_xmlhttp(parse_capability);
    xmlhttp.open("GET", url + "?service=SOS&request=GetCapabilities", true);
    xmlhttp.send();
}

/* 
* Update offering and property's selection of html;
* 
* @method parse_capability
* @param {String} responseText of a packet
* @return void
*/
function parse_capability(file) {
    capaiblity_xml = create_xml_reader(file);
    // function.call(this, arguments);
    var operations = parse_tag.call(capaiblity_xml, "Operation", "GetObservation");
    document.getElementById("offeringID").innerHTML = parse_offering_values(operations);
    document.getElementById("property").innerHTML = parse_propety_values(operations);
}

/* 
* Update begin and end Time of a choosed Offering
* Search offering name in capability xml for time information
* 
* @method update_time
* @param {String} a selected offering
* @return void
*/
function update_time(offering) {
    find_tag.call(capaiblity_xml, "offering", function (tag) {
        var id = tag.getElementsByTagName("identifier")[0];
        var offering_name = node_value(id);
        if (offering_name == offering) {
            document.getElementById("startTime").value = node_value(tag, "beginPosition");
            document.getElementById("endTime").value = node_value(tag, "endPosition");
        }
    });
}

/* 
* When a offering is selected
* Clean old DOM content and pack selected offering information
* Get new observations by sending post request to SOS
* 
* @method get_observation
* @return void
*/
function get_observation() {

    // clean up old offering and property.
    ["resultTable", "container", "describesensor"].forEach(function (id) {
        document.getElementById(id).innerHTML = '';
    });

    // get info of request.
    var info = {};
    ["sosURL", "offeringID", "property", "startTime", "endTime"].forEach(function (id) {
        info[id] = document.getElementById(id).value;
    });

    var request_body = get_observation_xml(info);
    var xmlhttp = create_xmlhttp(get_observation_handler);
    xmlhttp.open("POST", info.sosURL, true);
    xmlhttp.setRequestHeader("Content-type", "application/xml");
    xmlhttp.send(request_body);
}

/* 
* parse observations xml 
* add Marker on TGOS
* draw_chart by the results of observations
* 
* @method get_observation_handler
* @param {String} reponseText of a packet
* @return void
*/
function get_observation_handler(response) {

    if (response.indexOf('exception')) {
        console.log('There is a exception in GET observation response');
        return;
    }

    var xml_dom = create_xml_reader(response);
    var feature_of_interest = parse_get_observation_response(xml_dom);
    add_marker(feature_of_interest);
    draw_chart(feature_of_interest);
}

/* 
* For grouping all the offerings and observations
* 
* @method parse_get_observation_response
* @param {Object} xml object
* @return void
*/
function parse_get_observation_response(xml_dom) {
    var info = collect_info(xml_dom);
    var reading = new Reading(info);
    reading_group[info.feature] = reading;
    return info.feature;
}

/* 
* Add Marker on TGOS map, and set some options of marker and info window
* 
* @method add_marker
* @param {String} index of reading_group
* @return void
*/
function add_marker(feature_of_interest) {
    var point = new TGOS.TGPoint(reading.lon, reading.lat);
    var reading = reading_group[feature_of_interest];
    var marker = create_marker(point, reading.observations);
    var info_window_options = {
        maxWidth: 3000,
        pixelOffset: new TGOS.TGSize(5, -30),
        zIndex: 99
    };
    var service = document.getElementById("sosURL").value;
    var info_window = new TGOS.TGInfoWindow(info_window_message(service), point, info_window_options);
    TGOS.TGEvent.addListener(marker, "click", function () {
        info_window.open(tgos, marker);
        drawChart(marker.getTitle()[0][3]);
    });
    TGOS.TGEvent.addListener(marker, "rightclick", function () {
        info_window.close(tgos, marker);
    });
}

/* 
* Append a textarea for describe sensor text
* 
* @method create_describe_sensor_element
* @param {String} describe sensor text
* @return void
*/
function create_describe_sensor_element(response) {
    var node = document.createElement('textarea');
    node.setAttribute('rows', '100');
    node.setAttribute('cols', '100');
    node.value = response;
    document.getElementById("describesensor").innerHTML = "<h4><b>感測器描述文檔</b></h4>";
    document.getElementById("describesensor").appendChild(node);
}

/* 
* Send post request when describe sensor link is clicked
* 
* @method describe_sensor
* @param {String} Url of SOS
* @param {String} Procedure name
* @return void
*/
function describe_sensor(service, procedure) {
    var request_body = get_describe_sensor_xml(procedure);
    var xmlhttp = create_xmlhttp(create_describe_sensor_element);
    xmlhttp.open("POST", service, true);
    xmlhttp.setRequestHeader("Content-type", "application/xml");
    xmlhttp.send(request_body);
}

/* 
* Draw a line-chart for results of observations
* 
* @method describe_sensor
* @param {String} index of reading_group
* @return void
*/
function draw_chart(feature_of_interest) {

    var reading = reading_group[feature_of_interest];
    var property = reading.property;
    if (reading.property.indexOf(":") > -1) {
        property_full = reading.property.split(":");
        property = property_full[property_full.length - 1];
    }

    $(function () {
        $('#container').highcharts({
            chart: { zoomType: 'x' },
            title: { text: '時間序列' },
            xAxis: {
                type: 'datetime',
                title: { text: '時間' } },
            yAxis: {
                title: { text: property + ' (' + reading.uom + ')' },
                min: 0 },
            tooltip: {
                pointFormat: "<span style=\"color:{point.color}\">●</span>{point.x:" + property + '}: <b>{point.y:.2f} ' + reading.uom + '</b>' },
            plotOptions: { spline: { marker: { enabled: true } } },
            series: [{
                name: property,
                data: reading.observations
            }]
        });
    });
}