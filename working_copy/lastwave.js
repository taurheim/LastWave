//Created by Nikolai Savas 2014
/*
TODO:
 - Clean up code (general)
 - Add callbacks to functions instead of the weird flow that is currently happening
 - Download SVG
 - Add Point, Line, etc.
 - Custom error messages

Functions: 

submitWave()
	> Checks all of the input fields for errors
	> If date range & user haven't changed, re-draw the wave
	> If they have, re-load XML
resetXML()
	> shows the loading box
	> resets all of the loaded data
loadXML()
	> Loops through each week and calls "get_week()" for each
get_week()
	> Sends a delayed request to the server to get the specified week
	> If it's the last week, wait for all of the others to catch up
xmlwait()
	> Wait for all of the weeks to be completed, then parseXML()
parseXML()
	> Populate artist data


Utility Functions:

round_week()
round_month()
string.width()
string.height()
string.slope()

Objects:

artist_data()
	> Name: Artist's name
	> Data: String of each week
	> Crit Points: Critical points (the points we're going to be adding text to)


*/





/****************************
 ***** CONFIG SHIT **********
 ****************************/

//Input
var graph_options = {
	"user": "",
	"graph_height": 1500,
	"graph_width": 3000,
	"normalize": false,
	"show_months": true,
	"font_color": "#000000",
	"font_name": "Arial",
	"graph_type": "Wiggle",
	"time_start": 0,
	"time_end": 0,
	"min_playcount": 0,
	"total_weeks": 0,
	"palette": 0,
	"bgcolor": ""
};

//Calculated
var graph_data = {
	"userdata": {},
	"week_XML": [],
	"time_span": [],
	"series_data": [],
	"artists_order": [],
	"svg_data": "",
	"data_uri": "",
	"imgur_link": ""
}


//For testing purposes
var test_artist = "---";


//Initialize datepickers, convert buttons
  
$(document).ready(function() {
	//$("#save_as_svg").click(function() { submit_download_form("svg"); });
	//$("#save_as_png").click(function() { pngconvert(); });
	$("#share").click(function(){
		share();
	});
	$("#start_date").datepicker();
	$("#end_date").datepicker();
	$("#scheme").imagepicker({
		show_label  : true
	});
	$("#font_color").minicolors({
		position: 'bottom left'
	});
	$("#bgcolor").minicolors({
		position: 'bottom left'
	});
	$("#wave_color_start").minicolors({
		position: 'top left'
	});
	$("#wave_color_end").minicolors({
		position: 'top right'
	});
});

//Data structure, holds an artist's data
function artist_data(){
	this.name = "";
	this.data = [];
	this.crit_points = [];
	this.fontsize = 100;
}


//On the submit button being clicked
function submitWave(){
	//Number of minimum Plays
	graph_options.min_playcount = document.getElementById('plays').value;
	if(graph_options.min_playcount < 1){
		alert("Minimum number of plays to count is 1");
		return false;
	}

	//Graph Dimensions
	graph_options.graph_height = parseInt(document.getElementById("height").value) * 0.90;
	graph_options.graph_width = parseInt(document.getElementById("width").value);
	if(graph_options.graph_width>25000 || graph_options.graph_height>10000){
		alert("Caution: Choosing a graph this size may cause browser problems");
	}

	//Other options

	if (!loadScheme()){
		return false;
	}

	//End Time
	var rawdate = document.getElementById("end_date").value.split("/");
	var time_end = new Date(rawdate[2],parseInt(rawdate[0])-1,rawdate[1],"0","0","0","0").getTime()/1000;
	time_end = round_week(time_end)-302400;
	if(time_end > round_week((new Date).getTime()/1000)){
		alert("Your end date is in the future");
		return false;
	}

	//Start Time
	var rawdate = document.getElementById("start_date").value.split("/");
	var time_start = new Date(rawdate[2],parseInt(rawdate[0])-1,rawdate[1],"0","0","0","0").getTime()/1000;
	time_start = round_week(time_start)-302400;
	if(time_start>time_end){
		alert("Please check your time input");
		return false;
	}

	//Calculate total weeks
	total_weeks = Math.ceil((time_end-time_start)/604800);
	if (total_weeks<4){
		alert("Please choose a time of at least 4 weeks");
		return false;
	}

	//Make sure they've entered a username
	if(document.getElementById('user').value == ""){
		alert("Please enter a username");
		return false;
	}


	graph_options.total_weeks = total_weeks;

	//If the data set hasn't changed, then simply re-parse the data and re-draw the graph
	if(time_start == graph_options.time_start && 
		time_end == graph_options.time_end && 
		document.getElementById('user').value == graph_options.user)
	{
		//Set loading bar to 90% completion
		togglediv("#loading","true");
		$('#xml_loading').css("width", "90%");
		$('#graph_loading').css("width", "0%");
		$("#progresstext").html("Waiting...");

		//Parse XML
		setTimeout(function(){
			$("#progresstext").html("Parsing XML...");
			$('#graph_loading').css("width", "5%");
		},1000)
		setTimeout(parseXML,1500)
	} else {
		//Load the XML before moving on
		graph_options.time_start = time_start;
		graph_options.time_end = time_end;
		loadXML(document.getElementById('user').value);
	}

	//Hide settings box

	togglediv("#box_1",false);
	//$('#box_1').css("display","none");
}


//Load Scheme data (font color/background color)
// The data for custom schemes is in rickshaw.js
function loadScheme(){
	if(document.getElementById("scheme").value == "custom"){
		graph_options.font_name = document.getElementById("font_name").value;
		graph_options.graph_type = document.getElementById("graph_type").value;
		graph_options.showartistnames = document.getElementById("artist_names").checked;
		graph_options.normalize = document.getElementById("normalize").checked;
		graph_options.bgcolor = document.getElementById("bgcolor").value;
		graph_options.font_color = document.getElementById("font_color").value;
		return true;
	}else {
		graph_options.font_name = "Trebuchet MS";
		graph_options.graph_type = "silhouette";
		graph_options.normalize = document.getElementById("normalize").checked;
		graph_options.showartistnames = document.getElementById("artist_names").checked;
		graph_options.show_months = document.getElementById("show_months").checked;
		
		switch(document.getElementById("scheme").value){
			case "lastwave":
				graph_options.bgcolor = "#ffffff";
				graph_options.font_color = "#000000";
				break;
			case "forest":
				graph_options.bgcolor = "#444444";
				graph_options.font_color = "#ffffff";
				break;
			case "neon":
				graph_options.bgcolor = "#000000";
				graph_options.font_color = "#ffffff";
				break;
			case "fire":
				graph_options.bgcolor = "#000000";
				graph_options.font_color = "#000000";
				break;
			case "shades":
				graph_options.bgcolor = "#ffffff";
				graph_options.font_color = "#000000";
				break;
			case "carpet":
				graph_options.bgcolor = "#999999";
				graph_options.font_color = "#000000";
				break;
			case "assault":
				graph_options.bgcolor = "#444444";
				graph_options.font_color = "#000000";
				break;
			default:
				alert("Scheme not found!");
				return false
		}
		return true;

	}
}

//When a user changes the weeks of data being loaded, all the loaded data must be reset
function resetXML(){
	graph_data.userdata = {};
	graph_data.week_XML = [];
	graph_data.time_span = [];
	graph_data.series_data = [];
	graph_data.artists_order = [];
	togglediv("#loading",true);
}

//Load XML
function loadXML(selected_user) {
	resetXML();
	graph_options.user = selected_user;
	for(w=1;w<=graph_options.total_weeks;w++){
		get_week(selected_user,w);
	}
}

//Grab a specific week's data
function get_week(user, weeknum){

	setTimeout( function() { 
		//This is where the requests are all sent to the server.

		//Calculate the unix time start & unix time end of the week
		var week_start=graph_options.time_start+ (604800*(weeknum-1));
		var week_end=week_start + 604800;
		graph_data.time_span.push(week_start);

		//AJAX request
		graph_data.week_XML.push(
			$.get("http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user="+user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from="+week_start+"&to="+week_end)
			.fail(function() {
				//If there is a problem, show the 'errors div' and print the number of the week
				if(($('#errors').hasClass("unshown"))){
					togglediv("#errors",true);
					$('#err_weeks').append(weeknum);
				} else {
					$('#err_weeks').append(" ,"+weeknum);

				}
			})
		);

		//Update the progress of the bar and the text
		$('#progresstext').html("Loading week "+weeknum+" of "+total_weeks+"...<br/>");
		$('#xml_loading').css("width", parseInt(90*weeknum/total_weeks)+"%");


		//If it's the last week, wait for the rest of them to complete before drawing the graph
		if(weeknum==graph_options.total_weeks){
			$('#progresstext').html("Waiting...");
			setTimeout(xmlwait,500);
		}

	}, 250*(weeknum-1));
	/* ^^^^ Change this value to speed up/slow down data loading. 
			Last.fm's API  only  allows a request per second  for 
			each API key, but I figure I can probably send double
			that without getting them too angry.
	*/
	
}

//Some code I found online that will use deferred() and promise()s to make sure that everything is complete, THEN parse the XML.
function xmlwait() {

	$.when.apply($, $.map(graph_data.week_XML, function(d) {
	    var wrapDeferred = $.Deferred();
	    d.always(function() { wrapDeferred.resolve(); });
	    return wrapDeferred.promise();
	})).done(function(){
		$('#progresstext').html("Parsing XML...");
		$("#graph_loading").css("width","5%");
		setTimeout(parseXML,500);
	});
}

//Now that we've been returned some XML data, actually turn it into something useful
function parseXML(){
	var artist_plays = 0;
	var artist_name = "";
	var artist_count = 0;
	//Populates "userdata"
	graph_data.userdata= [];
	graph_data.series_data = [];
	graph_data.artists_order = [];

	//Run through every week, adding artists as we go

	for(w=1;w<=graph_options.total_weeks;w++){

		//Add an empty value for all artists (this will be overwritten if the artist doesn't get any plays in the current week)
		for(artist in graph_data.userdata){
			graph_data.userdata[artist].data[w] = [w,0];
		}

		//Check if this week failed to load
		if(graph_data.week_XML[w-1].status == 503){
			console.log("Error Loading Week "+w);
			continue;
		}


		week_data = graph_data.week_XML[w-1].responseXML;
		artist_count = week_data.getElementsByTagName("artist").length;
		
		//If week data is empty/error
		if((week_data.getElementsByTagName("lfm")[0].getAttribute("status") != "ok") || 
			week_data.getElementsByTagName("lfm")[0].childNodes.length<=1 ||
			artist_count==0
		){
			console.log("Empty Week "+w);
			continue;
		}

		if(week_data == undefined){
			console.log("Unexpectedly unable to parse week "+w)
			continue;
		}

		//Run through every artist, adding to "userdata" as we go
		for(i=0;i<artist_count;i++){
			//Get each artist name,playcount
			artist_name = week_data.getElementsByTagName("name")[i].childNodes[0].nodeValue;
			artist_plays = week_data.getElementsByTagName("playcount")[i].childNodes[0].nodeValue;

			//If our artist has more plays than the minimum playcount (set in the custom options)
			if((graph_data.userdata[artist_name]!=undefined) && parseInt(artist_plays)>=graph_options.min_playcount || (parseInt(artist_plays)>=graph_options.min_playcount)){
				if(graph_data.userdata[artist_name] == undefined){
					//Add an artist if the artist didn't previously exist, fill all previous values with 0s
					graph_data.userdata[artist_name] = new artist_data();
					graph_data.userdata[artist_name].name = artist_name;
					graph_data.userdata[artist_name].crit_points = [];

					for(n=0;n<=w;n++){
						graph_data.userdata[artist_name].data[n] = [n,0];
					}

				}
				
				//Add the data to userdata
				graph_data.userdata[artist_name].data[w] = [w,parseInt(artist_plays)];
			}
		}
	}

	calculate_critical_points();

	//Now that we've got all of our data, draw the wave
	$('#progresstext').html("Finished parsing XML...");

	if(isEmpty(graph_data.userdata)){
		alert("No data could be found for the specified timespan. Try changing your boundaries.")
	} else {
		$("#graph_loading").css("width","10%");
		$('#progresstext').html("Drawing Wave...");
		setTimeout(drawLastWave,500)
	}
}

function calculate_critical_points(){
	//Calculate Critical Points
	//Strategy:
	// Run through each non-zero week and find maximum value
	// Remove all weeks that are within a certain bound
	// Repeat until there are no remaining weeks to be maxes

	//Remove all weeks within a threshold of the critical point
	var threshold = 4;
	//This could be an algorithm that decides how far apart the artist names should be based on the pixel width and number of weeks (see comment below)
	//	parseInt(300/(graph_options.graph_width/graph_options.total_weeks));

	for(artist in graph_data.userdata){
		//Empty the critical points of the artist (array of Points)
		graph_data.userdata[artist].crit_points = [];
		var full_weeks = [];

		//Populate "full weeks" - At the start this will just be a list of 1 to ___ total weeks
		for(i=0;i<graph_options.total_weeks;i++){
			if(graph_data.userdata[artist].data[i+1][1]>0){
				full_weeks.push(i+1);
			}
		}

		//Keep removing weeks from the list until we have no weeks left
		while(full_weeks.length>0){
			//max_point : [week number, number of plays]
			var max_point = [0,0];

			//Find the maximum value
			for(week in full_weeks){
				if(max_point[1]<graph_data.userdata[artist].data[full_weeks[week]][1]){
					max_point = graph_data.userdata[artist].data[full_weeks[week]];
				}
			}

			//Push the position and size of the point (e.g. [4,121]) to the crit_points array. This number will then be calculated into an actual Crit_Point in the populateWave() function
			graph_data.userdata[artist].crit_points.push(graph_data.userdata[artist].data[max_point[0]]);

			//Remove all surrounding weeks from full_weeks
			for(w=max_point[0]-threshold;w<=max_point[0]+threshold;w++){
				var index = full_weeks.indexOf(w);
				if(index>-1){
					full_weeks.splice(index, 1);
				}
			}
		}
	}
}

//Here's where all the setup happens. The graph is created and drawn. 
// If all we wanted was a pretty graph (no artist names, no month names, etc.) 
// then we could just end the app here.
function drawLastWave(){

	//Since we're drawing a new graph, we won't be needing this:
	graph_data.data_uri = "";
	graph_data.imgur_link = "";
	graph_data.svg_data = "";


	$("#lastwave").css("display","block");

	document.getElementById("lastwave").innerHTML = "";

	//Populate the data for the wave from our XML
	graph_data.series_data = populateWave();

	graph = new Rickshaw.Graph( {
		element: document.querySelector("#lastwave"), 
		width: graph_options.graph_width, 
		height: graph_options.graph_height, 
		renderer: 'area',
		offset: graph_options.graph_type,
		stroke: true,
		preserve: true,
		series: graph_data.series_data,
		fill: "#000"
	});

	graph.render();


    d3.select("#lastwave").select("svg").attr("height",parseInt(graph_options.graph_height/0.90));

    //Draw the artist names?
	if(graph_options.showartistnames){
		//Make a new <g> to add the names to (at the end of the <svg> so that the text is always at the highest layer)
		d3.select("#lastwave").select("svg").append("g").attr("id","graph_names");
		drawNames();
	}
	
	//we want some space above and below the graph, so we actually need to translate pretty much everything a bit.
	d3.select("#lastwave").select("svg").selectAll("g")
		.attr("transform","translate(0,"+(parseInt(graph_options.graph_height/0.90)-graph_options.graph_height)/2+")");

	//Draw the background
	d3.select("#lastwave").select("svg").select("g").append("rect")
	    .attr("width", graph_options.graph_width)
	    .attr("height", graph_options.graph_height/0.90)
	    .attr("fill", graph_options.bgcolor)
	    .attr("x","0")
	    .attr("y",-1*(parseInt(graph_options.graph_height/0.90)-graph_options.graph_height)/2);

    $("#lastwave").css("width",graph_options.graph_width+8);

    //Draw the month names?
	if(graph_options.show_months){
		drawMonths();
	}

	//savas.ca/lastwave in the bottom right corner
	addWatermark();

	//Update progress, clean up ui
	$('#progresstext').html("Wave Complete!");
	$("#xml_loading").css("width","0%");
	$("#graph_loading").css("width","0%");
    togglediv("#edit_canvas",true);
	togglediv("#box_2",true);
	togglediv("#loading",false);

}

//This function is called at the start of drawLastWave(). Most of the data management is done here.
function populateWave(){
	var series_data = [];
	var colorscheme;
	$('#progresstext').html("Populating Wave...");


	//Order the artists
	for(artist in graph_data.userdata){
		graph_data.artists_order.push(graph_data.userdata[artist].name);
	}

	//Generate Colour Scheme
	if(scheme.value=="custom"){
		graph_options.palette = generateHue($("#wave_color_start").attr("value"),$("#wave_color_end").attr("value"),graph_data.artists_order.length,document.getElementById("cont_shade").checked);
	} else {
		graph_options.palette = new Rickshaw.Color.Palette( { scheme: scheme.value } );
	}




	//If "normalize" has been selected, order them so that the largest playcount is in the center
	// Since normalized graphs look nicer, I've made this setting default
	if(graph_options.normalize){
		var firsthalf = graph_data.artists_order.slice(0, graph_data.artists_order.length /2);
		var secondhalf = graph_data.artists_order.slice(graph_data.artists_order.length/2,graph_data.artists_order.length);

		firsthalf.sort(function (a,b){
			if(graph_data.userdata[a].crit_points[0][1]==graph_data.userdata[b].crit_points[0][1]){
				if(a>b) return -1; //This had to be added in so that browsers deal with the normalize in the same way. Otherwise if the two max values are equal, it's inconsistent across browsers
				return 1;
			} else {
				return graph_data.userdata[a].crit_points[0][1]-graph_data.userdata[b].crit_points[0][1];
			}
		});
		secondhalf.sort(function (a,b){
			if(graph_data.userdata[b].crit_points[0][1]==graph_data.userdata[a].crit_points[0][1]){
				if(b>a) return -1;
				return 1;
			} else {
				return graph_data.userdata[b].crit_points[0][1]-graph_data.userdata[a].crit_points[0][1];
			}
		});
		graph_data.artists_order = firsthalf.concat(secondhalf);
	}

	//Populate series data
	for(var a=0;a<graph_data.artists_order.length;a++){
		//Artist name
		var selected_artist = graph_data.artists_order[a];
		
		//Hold all the coordinate information in this temporary variable
		var tempdata = [];
		
		//Populate tempdata
		for(i=1;i<=graph_options.total_weeks;i++){
			if(graph_data.userdata[selected_artist].data[i] != undefined){
				tempdata[i-1] = new Point(graph_data.userdata[selected_artist].data[i][0],graph_data.userdata[selected_artist].data[i][1]);
			}
		}
		
		//Color Scheme
		if(Object.prototype.toString.call(graph_options.palette) === '[object Array]'){
			colorscheme = graph_options.palette.pop();
		} else {
			colorscheme = graph_options.palette.color();
		}

		//Populate series_data (each part is an artist)
		series_data[a]= {
			color: colorscheme,
			name: selected_artist,
			data: tempdata
		};
		
		}
	return series_data;
}

//If we want to have months shown in behind the graph
function drawMonths(){
	var month_name;
	var year_name;

	//Find the first <g> and add the month <g> to it. This makes sure that the month names 
	// and the line will be behind all of the wave lines. There is no prepend() for <svg>,
	// so this is the best option.
	d3.select("#lastwave").select("svg").select("g").append("g").attr("id", "Months");

	var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

	//If our rounded month is behind our start time, skip it
	for(var t=graph_options.time_start;t<graph_options.time_end;t+=2629743){
		var month = round_month(t);
		month_name = months[new Date((month*1000)+604800000).getMonth()];
		year_name = new Date((month*1000)+604800000).getFullYear();
		year_name = year_name.toString();

		if(month<graph_options.time_start){
			month+=2629743;
		}
		if(month>graph_options.time_end){
			break;
		}

		var month_line_x = (month-graph_options.time_start)/(graph_options.time_end-graph_options.time_start);
		month_line_x*= graph.width;

		//Draw month line
		d3.select("#lastwave").select("svg").select("#Months").append("line")
			.attr("x1",month_line_x)
			.attr("y1","0")
			.attr("x2",month_line_x)
			.attr("y2",graph.height-40)
			.attr("style","stroke:rgb(100,100,100);stroke-width:5;stroke-opacity: 0.2;");

		//Draw month text
		d3.select("#lastwave").select("svg").select("#Months").append("text")
			.text(month_name)
			.attr("x",month_line_x - month_name.width("20px Lucida Sans Unicode")/2)
			.attr("y",graph.height-20).attr("font-size",20)
			.attr("fill","#AAA")
			.attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif");

		if(month_name == "January"){
			//If it's January, show the year as well.
			d3.select("#lastwave").select("svg").select("#Months").append("text")
				.text(year_name)
				.attr("x",month_line_x - year_name.width("30px Lucida Sans Unicode")/2)
				.attr("y",graph.height+10).attr("font-size",30)
				.attr("fill","#AAA")
				.attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif");
		}
	}
}

//Collectively, this was the hardest part of LastWave. See my blog post on the making of LastWave (savas.ca/blog)
function drawNames(){
	$('#progresstext').html("Drawing Artist Names...");
	console.log("Drawing Names...");


	//Run through each artist, calculate the lines associated with each
	populate_lines();

	for(i=0;i<graph_data.artists_order.length;i++){
		var artist_name = graph_data.artists_order[i];
		for(pt in graph_data.userdata[artist_name].crit_points){
			//There are 16 different possible combinations of line slopes. 7 are eliminated (they never happen), which leaves 9 left.
			
			/* Here are the leftover options
				\/	/\	\\	//	/\	/\	\\	//	/\
				\/	/\	\\	//	//	\\	\/	\/	\/
				w1	w2	x1	x2	y1	y2	y3	y4	z1
			*/
			var cp = graph_data.userdata[artist_name].crit_points[pt];
			var label = false;
			//Now we need to figure out which type to draw.
			if(
				((cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope>=0)&&(cp.D.slope<=0)) ||
				((cp.A.slope<=0)&&(cp.B.slope>=0)&&(cp.C.slope<0)&&(cp.D.slope>0))
			){
				//Type "W"
				cp.type = "W";
				label = draw_W(cp,artist_name);
				//console.log(artist_name+" - W");
			}
			else if(
				((cp.A.slope<=0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope<=0))||
				((cp.A.slope>0)&&(cp.B.slope>=0)&&(cp.C.slope>=0)&&(cp.D.slope>0))
			){
				//Type "X"
				cp.type = "X";
				label = draw_X(cp,artist_name);
				//console.log(artist_name+" - X");
			}
			else if(
				(cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope>=0)&&(cp.D.slope>0)||
				(cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope<=0)||
				(cp.A.slope<=0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope>0)||
				(cp.A.slope>0)&&(cp.B.slope>=0)&&(cp.C.slope<0)&&(cp.D.slope>0)
			){
				//Type "Y"
				cp.type = "Y";
				label = draw_Y(cp,artist_name);
				//console.log(artist_name+" - Y");
			}
			else if(
				(cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope>0)
			){
				//Type "Z"
				cp.type = "Z";
				label = draw_Z(cp,artist_name);
				//console.log(artist_name+" - Z");
			} else {
				console.log("Error Loading Artist: "+artist_name);
				continue;
			}
			


			if(!label){// || label.fontsize<8){
				//console.log(artist_name +" failed with a font size of "+fontsize);
				continue;
			}
			d3.select("#lastwave").select("svg").select("#graph_names").append("text")
				.text(artist_name)
				.attr("x",label.x)
				.attr("y",label.y)
				.attr("font-size",label.fontsize)
				.attr("fill",graph_options.font_color)
				.attr("font-family",graph_options.font_name);
		
		}
	}
}

//Called at the start of drawNames(). Each critical point will need some 
// data about the surrounding lines before we can place the artist name.
function populate_lines(){

	var crit;
	
	for(i=0;i<graph_data.artists_order.length;i++){ //Run through each artist

		//Get Artist's name
		var artist_name = graph_data.artists_order[i];
		

		for(pt in graph_data.userdata[artist_name].crit_points){ //Run through each data point in the artist's data
			crit = new Crit_Point();
			//Find critical points for each of these points
			//console.log(graph_data.userdata[artist_name].crit_points[point]);
			//
			//     \     /
			//    A \ q / B
			//        o
			//       			A,B,C,D are equations of lines
			//					a,b are the upper and lower points
			//					all calculations will be done in pixels, so we need to convert it all using our ratios.
			//					all calculations also done with bottom being down (at the end we need to convert graph.height-y values)
			//        o
			//    C / r  \ D
			//    /       \
			//
			crit.origin = new Point();//graph_data.userdata[artist_name].crit_points[pt];
			
			var x_point = graph_data.userdata[artist_name].crit_points[pt][0];
			var xratio = getRatio(0);
			var yratio = getRatio(1);

			crit.q.x = (x_point-1)*xratio;

			crit.q.y = (graph_data.series_data[i].stack[x_point-1].y + graph_data.series_data[i].stack[x_point-1].y0)*yratio;
			crit.r.x = (x_point-1)*xratio;
			crit.r.y = (graph_data.series_data[i].stack[x_point-1].y0)*yratio;

			//If we're on the edge, add the left/right points accordingly
			if(x_point-2<0){
				crit.topleft.x = (x_point-1)*xratio -5;
				crit.topleft.y = crit.r.y+((crit.q.y-crit.r.y)/2);
				crit.btmleft.x = (x_point-1)*xratio -5;
				crit.btmleft.y = crit.r.y+((crit.q.y-crit.r.y)/2);
			} else {
				crit.topleft.x = (x_point-2)*xratio;
				crit.topleft.y = (graph_data.series_data[i].stack[x_point-2].y + graph_data.series_data[i].stack[x_point-2].y0)*yratio;
				crit.btmleft.x = (x_point-2)*xratio;
				crit.btmleft.y = (graph_data.series_data[i].stack[x_point-2].y0)*yratio;
			}
			
			if((x_point)==(graph_options.total_weeks)){
				crit.topright.x = ((x_point-1)*xratio)+5;
				crit.topright.y = (crit.r.y)+((crit.q.y-crit.r.y)/2);
				crit.btmright.x = ((x_point-1)*xratio)+5
				crit.btmright.y = (crit.r.y)+((crit.q.y-crit.r.y)/2);
			} else {
				crit.topright.x = (x_point)*xratio;
				crit.topright.y = (graph_data.series_data[i].stack[x_point].y + graph_data.series_data[i].stack[x_point].y0)*yratio;
				crit.btmright.x = (x_point)*xratio;
				crit.btmright.y = (graph_data.series_data[i].stack[x_point].y0)*yratio;
			}

			crit.A = new Line(crit.topleft,crit.q);
			crit.B = new Line(crit.q,crit.topright);
			crit.C = new Line(crit.btmleft,crit.r);
			crit.D = new Line(crit.r,crit.btmright);
			
			//Round
			crit.A.slope = parseInt(crit.A.slope*10000000000)/10000000000;
			crit.B.slope = parseInt(crit.B.slope*10000000000)/10000000000;
			crit.C.slope = parseInt(crit.C.slope*10000000000)/10000000000;
			crit.D.slope = parseInt(crit.D.slope*10000000000)/10000000000;

			graph_data.userdata[artist_name].crit_points[pt] = crit;

			if(artist_name==test_artist){
				console.log(crit);
				d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",crit.topleft.x).attr("y1",graph_options.graph_height-crit.topleft.y).attr("x2",crit.q.x).attr("y2",graph_options.graph_height-crit.q.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",crit.btmleft.x).attr("y1",graph_options.graph_height-crit.btmleft.y).attr("x2",crit.r.x).attr("y2",graph_options.graph_height-crit.r.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",crit.q.x).attr("y1",graph_options.graph_height-crit.q.y).attr("x2",crit.topright.x).attr("y2",graph_options.graph_height-crit.topright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",crit.r.x).attr("y1",graph_options.graph_height-crit.r.y).attr("x2",crit.btmright.x).attr("y2",graph_options.graph_height-crit.btmright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				//d3.select("#lastwave").select("svg").append("circle").attr("cx",crit.q.x).attr("cy",graph_options.graph_height-crit.q.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
				
			}
		}
	}
}

function draw_W(cp,artist_name){
	// TYPE: w
	// DESCRIPTION: One set facing inwards, one set facing outwards
	// APPROACH: Assume that the text box's side must touch one of the points, and is then bounded by the left and right by the inward facing lines
	
	//cp is a Crit_Point
	var fontsize = 5;
	if(cp.A.slope>0){ // w2
		var btm_bound = cp.r.y;
		while(true){
			//Find the bottom bound of our textbox
			top_bound = cp.r.y + fontsize;

			//Left bound of the bottom bound
			var coll_left = (top_bound - cp.A.y_int)/cp.A.slope;
			if(coll_left<cp.topleft.x) coll_left=cp.topleft.x;

			//Where the bottom bound hits line B
			var coll_right = (top_bound - cp.B.y_int)/cp.B.slope;
			if(coll_right>cp.topright.x) coll_right=cp.topright.x;

			//Find out what the width of the box would be if we had the current fontsize
			var boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);

			//Does it fit?
			if((coll_right-coll_left)>(cp.topright.x-cp.topleft.x)){
				//If the size of the box is larger than the size of the space, max it out.
				coll_left = cp.topleft.x;
				fontsize = cp.topleft.y - coll_left.y;
				break;
			} else if((coll_right-coll_left)>boxWidth){
				fontsize+=2;
			} else {
				break;
			}
		}
		/*if(artist_name.height(fontsize+"px "+font_name)>cp.q.y-cp.r.y){
			//TODO
			//Change this so that it will keep subtracting font sizes until it fits
			alert(artist_name);
			fontsize = cp.q.y-cp.r.y;
		}*/
		fontsize*=0.75;
		y_value_for_max_point = graph_options.graph_height - top_bound + artist_name.height(fontsize+"px "+graph_options.font_name)/2;
	} else { //w1
		//console.log("\\\/"+artist_name);
		var top_bound = cp.q.y;
		while(true){
			//Find the bottom bound of our textbox
			var btm_bound = cp.q.y - fontsize;

			var coll_left = (btm_bound - cp.C.y_int)/cp.C.slope;
			if(coll_left<cp.topleft.x) coll_left=cp.topleft.x;

			var coll_right = (btm_bound - cp.D.y_int)/cp.D.slope;
			if(coll_right>cp.topright.x) coll_right=cp.topright.x;

			var boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
			if((coll_right-coll_left)>(cp.topright.x-cp.topleft.x)){
				coll_left = cp.topleft.x;
				fontsize = top_bound - cp.btmleft.y;
				break;
			} else if((coll_right-coll_left)>(boxWidth)){
				fontsize+=2;
			} else {
				break;
			}
		}
		//CHANGE THIS (see above)
		if(artist_name.height(fontsize+"px "+graph_options.font_name)>cp.q.y-cp.r.y){
			fontsize = cp.q.y-cp.r.y;
		}
		fontsize*=0.75;
		y_value_for_max_point = graph_options.graph_height - top_bound + artist_name.height(fontsize+"px "+graph_options.font_name);
	}
	boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
	x_value_for_max_point = coll_left;//+boxWidth*0.15;
	/*if(fontsize==5){
		console.log("Skipping "+artist_name);
		continue;
	}*/
	//Extra positioning to make up for curves
	if(cp.C.slope<0.5 && cp.C.slope>0 && cp.D.slope<-1.5){
		y_value_for_max_point -= artist_name.height(fontsize+"px "+graph_options.font_name)/2;
		console.log("[w]Correcting "+artist_name);
	}

	return {
		"x": x_value_for_max_point,
		"y": y_value_for_max_point,
		"fontsize": fontsize
	};
}

function draw_X(cp,artist_name){
	//Run through all y values, check width.
	//maxWidth = [actual width, y value, left_coll]
	var maxWidth = [0,0];
	var coll_left;
	var coll_right;
	var top_collision;
	var btm_collision;
	for (v=(cp.r.y+1);v<cp.q.y;v++){
		if(cp.A.slope>=0){
			coll_left = (v-cp.A.y_int)/cp.A.slope;
			coll_right = (v-cp.D.y_int)/cp.D.slope;
		} else {
			coll_left = (v-cp.C.y_int)/cp.C.slope;
			coll_right = (v-cp.B.y_int)/cp.B.slope;
		}
		//If either of our collisions are outside of the bounds, then (FOR NOW) we will just cut it off there, but later we could add it so that it looks at the surrounding area to maximize the font further.
		if(coll_left<cp.topleft.x) coll_left = cp.topleft.x;
		if(coll_right>cp.topright.x) coll_right = cp.topright.x;

		var pointWidth = coll_right-coll_left;
		if(pointWidth > maxWidth[0]){
			maxWidth[0] = pointWidth;
			maxWidth[1] = v;
			maxWidth[2] = coll_left;
		}
	
	}
	
	//Find out the slope of the box from the topleft corner to the bottomleft corner (height/width)
	//From now on, this diagonal is referred to as "diag"
	var ctrpt = new Point(maxWidth[2]+maxWidth[0]/2,maxWidth[1]);

	//Since we actually don't know the start and end points, we can keep mDiag and bDiag (slope and y intercept)
	var mDiag = artist_name.slope(graph_options.font_name);
	if(cp.A.slope>0) mDiag*=-1;
	var bDiag = ctrpt.y - mDiag*ctrpt.x;
	
	//Now find the points of intersection of diag with all of the other lines x = b2 - b1/m1 - m2
	//A
	var diag_A = new Point((bDiag-cp.A.y_int)/(cp.A.slope - mDiag),mDiag*((bDiag-cp.A.y_int)/(cp.A.slope - mDiag)) + bDiag);
	//B
	var diag_B = new Point((bDiag-cp.B.y_int)/(cp.B.slope - mDiag),mDiag*((bDiag-cp.B.y_int)/(cp.B.slope - mDiag)) + bDiag);
	//C
	var diag_C = new Point((bDiag-cp.C.y_int)/(cp.C.slope - mDiag),mDiag*((bDiag-cp.C.y_int)/(cp.C.slope - mDiag)) + bDiag);
	//D
	var diag_D = new Point((bDiag-cp.D.y_int)/(cp.D.slope - mDiag),mDiag*((bDiag-cp.D.y_int)/(cp.D.slope - mDiag)) + bDiag);
	
	//Now we have a bunch of intersection points, but don't know which one is the "real" border, so we're going to find a top and bottom collision
	//Top collision
	
	//Ignore intersections if:
	// A collision is right of the center
	// B collision is left of the center
	// C collision is right of the center
	// D collision is left of the center
	if(diag_A.x > cp.q.x) {top_collision = diag_B}
	if(diag_B.x < cp.q.x) {top_collision = diag_A}
	if(diag_C.x > cp.q.x) {btm_collision = diag_D}
	if(diag_D.x < cp.q.x) {btm_collision = diag_C}
	//if(artist_name=="Daft Punk") var btm_collision = diag_C;
	
	//if(diag_A.y < diag_B.y) {top_collision = diag_A;} else {top_collision = diag_B;}
	//if(diag_C.y > diag_D.y) {btm_collision = diag_C;} else {btm_collision = diag_D;}
	if(typeof top_collision === 'undefined'){
		console.log("[x] Error labelling "+artist_name);
		return false;
	}
	fontsize = Math.abs(parseInt((top_collision.x-btm_collision.x)*artist_name.slope()));
	if(fontsize>cp.q.y-cp.r.y){
		fontsize = Math.abs(cp.q.y-cp.r.y);
	}
	
	fontsize*=0.9;
	var boxHeight = artist_name.height(fontsize+"px "+graph_options.font_name);
	var boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
	
	//Which x/y values we pick is based on whether we have the graph getting steeper/shallower after a&b

	//If it gets a lot steeper after the center points, then adjust.
	if(cp.A.slope<0 && cp.B.slope<cp.A.slope && cp.D.slope<cp.C.slope && Math.abs(cp.D.slope-cp.C.slope)>0.4 && cp.topleft.y == cp.btmleft.y){
		console.log("[x] trigger "+ artist_name)
		x_value_for_max_point = Math.max(top_collision.x,btm_collision.x) - boxWidth;
		y_value_for_max_point = graph.height - top_collision.y + boxHeight*0.3;
	} else if(cp.A.slope>0 && cp.B.slope<cp.A.slope && cp.D.slope<cp.C.slope && Math.abs(cp.D.slope-cp.C.slope)>0.4 && cp.topleft.y == cp.btmleft.y){
		console.log("[x] trigger 2 "+artist_name);
		x_value_for_max_point = Math.min(top_collision.x,btm_collision.x) - boxWidth/1.2;
		y_value_for_max_point = graph.height - btm_collision.y - boxHeight*0.3;
	} else {
		x_value_for_max_point = Math.min(top_collision.x,btm_collision.x);//ctrpt.x - boxWidth/2;
		y_value_for_max_point = graph_options.graph_height-btm_collision.y;//graph.height - maxWidth[1] + boxHeight/2;
	}

	//If it's a lot less steep after the center points, then adjust



	//There's no way I can make an estimate for this
	if((Math.abs(cp.A.slope+cp.C.slope)<0.25 && Math.abs(cp.B.slope+cp.D.slope)>2) || (Math.abs(cp.B.slope+cp.D.slope)<0.25 && Math.abs(cp.A.slope+cp.C.slope)>2) ){
		console.log("[x] Impossible to estimate "+artist_name);
		return false;
	}
	if(artist_name==test_artist){
		console.log(coll_right);
		console.log(maxWidth);
		//Green line
		d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",maxWidth[2]).attr("y1",graph_options.graph_height-maxWidth[1]).attr("x2",maxWidth[2]+maxWidth[0]).attr("y2",graph.height-maxWidth[1]).attr("style","stroke:rgb(0,255,0);stroke-width:1");
		d3.select("#lastwave").select("svg").select("#graph_names").append("circle").attr("cx",top_collision.x).attr("cy",graph_options.graph_height - top_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
		d3.select("#lastwave").select("svg").select("#graph_names").append("circle").attr("cx",btm_collision.x).attr("cy",graph_options.graph_height - btm_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
		d3.select("#lastwave").select("svg").select("#graph_names").append("circle").attr("cx",ctrpt.x).attr("cy",graph_options.graph_height - ctrpt.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
	
	}
	return {
		"x": x_value_for_max_point,
		"y": y_value_for_max_point,
		"fontsize": fontsize
	};
}

function draw_Y(cp,artist_name){
	//Let's get our starting point, and figure out the sign of our first line.
	var fontsize = 8;
	var start_point; //a or b
	var end_point;
	var offset_sign; //In step 3, we need to offset. If our start point is a, we offset downwards (-1), if it is b, we offset upwards (1)
	var slope_sign; //1 or -1

	var ray_slope = artist_name.slope(); //slope of initial line
	var ray_direction;

	var O; //Opposite side line
	var V; //Horizontally opposite to O
	var U; //Vertically opposite to V
	var Q; //First line
	var X; //Second line

	var x_value_for_max_point;
	var y_value_for_max_point;
	var intersect1;
	var intersect2;
	//var U.y_int;
	var offset = 0; //This variable is helpful to move the text to give room for curved edges (we pretend like we're only dealing with flat in all the calculations)
	if(cp.A.slope<=0 && cp.B.slope<0 || cp.A.slope>=0 && cp.B.slope>=0) {
		start_point = cp.q;
		offset_sign = -1;
		if(cp.A.slope>0 || cp.A.slope==0 && cp.B.slope>0){ //Opposite line: D -> C ^ A
			ray_direction = "r";
			//console.log("a");
			slope_sign = -1;

			O = new Line(cp.D.start_point,cp.D.end_point);
			V = new Line(cp.C.start_point,cp.C.end_point);
			U = new Line(cp.A.start_point,cp.A.end_point);
		
		}
		if(cp.A.slope<0 || cp.A.slope==0 && cp.B.slope<0){ //Opposite line: C -> D ^ B
			ray_direction = "l";	
			//console.log("b");
			slope_sign = 1;

			O = new Line(cp.C.start_point,cp.C.end_point);
			V = new Line(cp.D.start_point,cp.D.end_point);
			U = new Line(cp.B.start_point,cp.B.end_point);

		}
	} else if(cp.C.slope<=0 && cp.D.slope<=0 || cp.C.slope>=0 && cp.D.slope>0) {
		start_point = cp.r;
		offset_sign = 1;
		if(cp.C.slope>=0){ //Opposite line: A -> B ^ D
			ray_direction = "l";
			//console.log("c");
			slope_sign = -1;

			O = new Line(cp.A.start_point,cp.A.end_point);
			V = new Line(cp.B.start_point,cp.B.end_point);
			U = new Line(cp.D.start_point,cp.D.end_point);

			if(cp.C.slope<0.2 && cp.D.slope>1){
				offset=1;
			}
		}
		if(cp.C.slope<0){ //Opposite line: B -> A ^ C
			ray_direction = "r";
			//console.log("d");
			slope_sign = 1;

			O = new Line(cp.B.start_point,cp.B.end_point);
			V = new Line(cp.A.start_point,cp.A.end_point);
			U = new Line(cp.C.start_point,cp.C.end_point);

			if(cp.C.slope>-0.2 && cp.D.slope<-1){
				offset=1;
			}
		}
	} else {
		console.log("Really weird error - "+artist_name);
		console.log(artist_name + " - y" + " - " + cp.A.slope + "," + cp.B.slope + "," + cp.C.slope + "," + cp.D.slope);
		return false;
	}
	
	//Draw the line (from now on referred to as Q)
	/*RECURSIVE PART*/
	//while(true) {
	//if(artist_name == "Said The Whale"){
	
	
	var count=0;
	var last_last_last_fontsize = 0;
	var last_last_fontsize = 0;
	var last_fontsize = 0;
	var previous_start_point = {"x":0,"y":0};
	while(true){
		/*CLARIFICATION:
							 |
				   o\	line V
				  /    \  (2)|
		line O	/		 (  \|
			  / 	  (      |
		 (1)/	   X		 /
		  /	)	 (		   / |
		/	   Q	    /    |
		|	  (	 )	 /	line U
		|	(	   o		 |
		| (  ____ /	start_po |
		|  /		   int   |
		   
		*/
		count++;

		//First we're going to cast a ray going from the start point to the opposing line. Check for collisions with all sides. Since the ray always starts on the same side as "U", just check O and V
		Q = new Ray(start_point,ray_slope*slope_sign,ray_direction,[O,V]);

		//If we collided with line V first, then break the loop
		if(!Q.collidedWith){
			//If we didn't collide with anything
			if(O.start_point == V.end_point){ //  V/ \O
				intersect1 = O.end_point;
			} else { // O/ \V
				intersect1 = O.start_point;
			}
		} else if(Q.collidedWith == 1){
			//Collision with V
			start_point = new Point(Q.end_point.x,U.slope*Q.end_point.x + U.y_int);
			continue;
		} else { 
			//Collision with O
			intersect1 = Q.end_point;
		}

		//Now draw another line vertically opposite to intersect1 and up in the other direction
		var Xstart = new Point(intersect1.x, start_point.y);
		var Xdirection;
			if(ray_direction == "l"){
				Xdirection = "r";
			} else {
				Xdirection = "l";
			}

		//Draw Ray
		var X = new Ray(Xstart,ray_slope*slope_sign*-1,Xdirection,[U,V]);

		//Check if we didn't make a collision
		if(!X.collidedWith){ //http://i.imgur.com/61YmgJt.png Just misses V
			if(O.start_point == V.end_point){
				intersect2 = V.start_point;
			} else {
				intersect2 = V.end_point;
			}
		} else{
			intersect2 = X.end_point;
		}

		

		if(artist_name==test_artist){
			//green line (start_point -> intersect1)
			d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",start_point.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect1.x).attr("y2",graph_options.graph_height-intersect1.y).attr("style","stroke:rgb(0,255,0);stroke-width:1");
			//blue line  (intersect1 -> intersect2) (X)
			d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",intersect1.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect2.x).attr("y2",graph_options.graph_height-intersect2.y).attr("style","stroke:rgb(0,0,255);stroke-width:1");
			
			//intersect2
			d3.select("#lastwave").select("svg").select("#graph_names").append("circle").attr("cx",intersect2.x).attr("cy",graph_options.graph_height-intersect2.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
		}
		
		//Check if we're out of our bounds
		if(intersect2.x < cp.topleft.x || intersect2.x > cp.topright.x){
			intersect2.x = (intersect2.y - U.y_int)/U.slope;
		}
		
		previous_start_point = start_point;

		if(intersect2.x<cp.topleft.x){
			intersect2.x= cp.topleft.x;
		}
		if(intersect2.x>cp.topright.x){
			intersect2.x = cp.topright.x;
		}

		start_point = {"x": intersect2.x, "y": U.slope*intersect2.x + U.y_int};
		
		//Check for bounces
		if(Math.round(intersect1.y-previous_start_point.y) == last_last_fontsize || Math.round(intersect1.y-previous_start_point.y) == last_last_last_fontsize){
			//console.log("Found a bounce at "+count);
			//console.log(previous_start_point);
			break;
		}
		last_last_last_fontsize = last_last_fontsize;
		last_last_fontsize = last_fontsize;
		last_fontsize = Math.round(intersect1.y-previous_start_point.y);
		if(count==100){
			//console.log("FINAL VALUE: "+(intersect1.y-previous_start_point.y));
			console.log("[y] Ran into problems trying to place label for "+artist_name+", Current font size at: "+Math.round(Math.abs(intersect1.y-previous_start_point.y))+"px");
			break;
		} else {
			//console.log(intersect1.y-previous_start_point.y);
		}
	}
	
	fontsize = Math.round(Math.abs(intersect1.y-previous_start_point.y));
	fontsize*= 0.8;

	//If the way the font size is calculated means that it's too large, size it down.
	if(cp.topright.x - cp.topleft.x < artist_name.width(fontsize+"px "+graph_options.font_name)){
		fontsize = artist_name.slope(graph_options.font_name)*(cp.topright.x - cp.topleft.x);
		console.log("[y] Resizing to fit in space: " + artist_name);
	}
	//Pick value cp.A.bsed on type
						 
	//y1
	if((cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope>=0)&&(cp.D.slope>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph_options.graph_height - start_point.y;}
	//y2
	if((cp.A.slope>0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope<=0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph_options.graph_height - previous_start_point.y;}
	//y3
	if((cp.A.slope<=0)&&(cp.B.slope<0)&&(cp.C.slope<0)&&(cp.D.slope>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph_options.graph_height - intersect2.y;}
	//y4
	if((cp.A.slope>0)&&(cp.B.slope>=0)&&(cp.C.slope<0)&&(cp.D.slope>0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph_options.graph_height - intersect2.y;}
	//x_value_for_max_point = cp.A.slopeth.min(start_point.x,intersect1.x,intersect2.x);
	
	//y_value_for_max_point = graph_options.graph_height - cp.A.slopeth.min(start_point.y,intersect1.y,intersect2.y);// - cp.A.slopeth.abs((  intersect2.y - start_point.y - artist_name.height(fontsize+"px "+graph_options.font_name) )/2);// - fontsize*offset;
	
	if(artist_name==test_artist){
			//black line (start_point -> intersect1)
			d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",start_point.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect1.x).attr("y2",graph_options.graph_height-intersect1.y).attr("style","stroke:rgb(0,0,0);stroke-width:1");
			//white line  (intersect1 -> intersect2)
			d3.select("#lastwave").select("svg").select("#graph_names").append("line").attr("x1",intersect1.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect2.x).attr("y2",graph_options.graph_height-intersect2.y).attr("style","stroke:rgb(255,255,255);stroke-width:1");
			//black dot - final resting point
			d3.select("#lastwave").select("svg").select("#graph_names").append("circle").attr("cx",x_value_for_max_point).attr("cy",y_value_for_max_point).attr("r",3).attr("stroke-width",5).attr("fill","black");
	}
	//Curve fixes

	//if C is flat and D is steep
	if(cp.C.slope>-0.5 && cp.C.slope<0.5 && cp.D.slope<-0.9 && (y_value_for_max_point<(cp.r.y-Math.abs(cp.r.y-cp.q.y)))){
		//x_value_for_max_point += "W".width(fontsize+"px "+graph_options.font_name);
		y_value_for_max_point -= (.5*artist_name.height(fontsize+"px "+graph_options.font_name));
		//if(artist_name ==test_artist){
		console.log("[y]Correcting " + artist_name);
		//}
	}

	//If the left side is larger than the right side, move the text to the left a little (aesthetics)
	if(cp.topleft.y-cp.btmleft.y > cp.topright.y - cp.btmright.y //If the left side is larger
		&& (cp.A.slope < 0.2 && cp.A.slope > -0.2) //If the slope of A is relatively low
		&& (cp.B.slope < 0.2 && cp.B.slope > -0.2) //If the slope of B is relatively low
		&& (cp.topleft.y - cp.btmleft.y) > (cp.q.y-cp.r.y)*0.85){ //If the left side is about the same size as the middle distance
		x_value_for_max_point -= (cp.q.x-cp.topleft.x)*0.5;
		console.log("[y] Aesthetic Fix - "+artist_name);
	}


	return {
		"x": x_value_for_max_point,
		"y": y_value_for_max_point,
		"fontsize": fontsize
	};
}

function draw_Z(cp,artist_name){
	//Get all the midpoints
	var rightMP = {"x": (cp.topright.x+cp.btmright.x)/2, "y" : (cp.topright.y+cp.btmright.y)/2};
	var leftMP = {"x": (cp.topleft.x+cp.btmleft.x)/2, "y" : (cp.topleft.y+cp.btmleft.y)/2};
	var middleMP = {"x": (leftMP.x+rightMP.x)/2, "y" : (leftMP.y+rightMP.y)/2};
	var boxBottom,boxBtmWidth,boxHeight,boxWidth,boxTopWidth,boxTop,coll_A,coll_B,coll_C,coll_D,coll_btmleft,coll_topright,coll_btmright,coll_topleft;

	if(Math.abs(cp.A.slope - cp.B.slope)<0.1 || Math.abs(cp.C.slope - cp.D.slope)<0.1 ){
		middleMP = new Point(cp.q.x,(cp.q.y+cp.r.y)/2);
		console.log("Replacing midpoint for "+artist_name);
	}
	
	//Base font size
	fontsize = 6;
	while(true){
		//Moving out from the center point, increase the font size and check for collisions
		boxHeight = fontsize;
		boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
			
		//Get a y value for the top and bottom of the constraint box
		boxTop = middleMP.y + boxHeight/2;
		boxBottom = middleMP.y - boxHeight/2;
		//Check left and right collisions, distance between them
		//Top
		coll_A = (boxTop-cp.A.y_int)/cp.A.slope;
		coll_C = (boxTop-cp.C.y_int)/cp.C.slope;
		coll_topleft = Math.max(coll_A,coll_C);
		if(coll_topleft<cp.topleft.x) coll_topleft = cp.topleft.x;
		
		coll_B = (boxTop-cp.B.y_int)/cp.B.slope;
		coll_D = (boxTop-cp.D.y_int)/cp.D.slope;
		coll_topright = Math.min(coll_B,coll_D);
		if(coll_topright>cp.topright.x) coll_topright = cp.topright.x;
		
		boxTopWidth = coll_topright-coll_topleft;
		
		//Bottom
		coll_A = (boxBottom-cp.A.y_int)/cp.A.slope;
		coll_C = (boxBottom-cp.C.y_int)/cp.C.slope;
		coll_btmleft = Math.max(coll_A,coll_C);
		if(coll_btmleft<cp.topleft.x) coll_btmleft = cp.topleft.x;
		
		coll_B = (boxBottom-cp.B.y_int)/cp.B.slope;
		coll_D = (boxBottom-cp.D.y_int)/cp.D.slope;
		coll_btmright = Math.min(coll_B,coll_D);
		if(coll_btmright>cp.topright.x) coll_btmright = cp.topright.x;
		
		boxBtmWidth = coll_btmright-coll_btmleft;
		
		//If we've overstepped our boundaries
		if(Math.min(boxBtmWidth,boxTopWidth)<boxWidth){
			break;
		}
		
		//Otherwise, increase the font size.
		fontsize+=2;
	}
	fontsize*=0.75;
	boxHeight*=0.75;
	x_value_for_max_point = Math.max(coll_topleft,coll_btmleft);
	y_value_for_max_point = graph_options.graph_height - middleMP.y + boxHeight/2;

	return {
		"x": x_value_for_max_point,
		"y": y_value_for_max_point,
		"fontsize": fontsize
	};
}


/* Structs */

function Line(start_point, end_point) {
	this.start_point = start_point;
	this.end_point = end_point;

	//Slope = Rise/Run
	this.slope = (end_point.y - start_point.y)/(end_point.x - start_point.x);

	//Y-intercept b = y-mx
	this.y_int = start_point.y - this.slope*start_point.x;
}

function Point(x,y) {
	this.x = x;
	this.y = y;
}


function Crit_Point(){
	//topleft		topright
	//     \     /
	//    A \ q / B
	//        o
	//       			A,B,C,D are equations of lines
	//					a,b are the upper and lower points
	//					all calculations will be done in pixels, so we need to convert it all using our ratios.
	//					all calculations also done with bottom being down (at the end we need to convert graph.height-y values)
	//        o
	//    C / r  \ D
	//    /       \
	//btmleft		btmright
	this.q = new Point();
	this.r = new Point();
	this.A;
	this.B;
	this.C;
	this.D;
	this.topleft = new Point();
	this.topright = new Point();
	this.btmleft = new Point();
	this.btmright = new Point();
	this.origin = new Point();
	this.type = "";
}

function Ray(start_point,slope,direction,lineArray){
	/*
		@start_point The beginning point of the ray
		@slope Slope of the ray (positive or negative number)
		@direction "r" or "l" to represent left or right. The other way to do this would be using polar coordinates but I don't think it makes sense to add that layer of complexity
		@lineArray List of lines to check. The function will find the closest one (where the ray stops)
	*/
	this.start_point = start_point;
	this.slope = slope;
	this.collidedWith = false;
	var minlen = false;
	var currentlen;
	var intersectpt = false;
	var y_int = start_point.y - slope*start_point.x;
	var testline;

	//Pretty much just pretend it's a huge line
	if(direction == "l"){
		testLine = new Line(start_point,new Point(start_point.x - 1000000000,this.slope*(start_point.x - 1000000000) + y_int,start_point));
	} else {
		testLine = new Line(start_point,new Point(start_point.x + 1000000000,this.slope*(start_point.x + 1000000000) + y_int,start_point));
	}

	for(line in lineArray){
		//intersectpt is the intersection of the ray and the line
		intersectpt = get_intersect(lineArray[line],testLine);
		if(intersectpt){
			//if they do interesect, check with minlen
			if(!minlen || point_distance(start_point,intersectpt) < minlen){
				minlen = point_distance(start_point,intersectpt);
				this.collidedWith = line; //give our object the id of the collided
				this.end_point = intersectpt;
			}
		}
	}
	this.length = minlen;

}

/* Line & Point functions */


function get_intersect(line1, line2) {
	var x = (line2.y_int - line1.y_int)/(line1.slope - line2.slope);
	var y = ((line2.slope)*(line2.y_int - line1.y_int)/(line1.slope - line2.slope))+line2.y_int;

	var intersection = new Point(x,y);

	if(x.isBetween(line1.start_point.x,line1.end_point.x) && y.isBetween(line1.start_point.y,line1.end_point.y)
	&& x.isBetween(line2.start_point.x,line2.end_point.x) && y.isBetween(line2.start_point.y,line2.end_point.y)){
		return intersection;
	} else {
		return false;
	}
}

function get_length(line){
	//d = sqrt( (x2-x1)^2 + (y2-y1)^2);
	var d = Math.sqrt((line.end_point.x - line.start_point.x)*(line.end_point.x - line.start_point.x) + (line.end_point.y - line.start_point.y)*(line.end_point.y - line.start_point.y));
	return d;
}


function get_midpoint(line) {
	var x = line.end_point.x - line.start_point.x;
	var y = line.end_point.y - line.start_point.y;

	var midpoint = new Point(x,y);

	return midpoint;
}

function point_distance(point1,point2){
  var xs = 0;
  var ys = 0;
 
  xs = point2.x - point1.x;
  xs = xs * xs;
 
  ys = point2.y - point1.y;
  ys = ys * ys;
 
  return Math.sqrt( xs + ys );
}


/*Other functions*/


function share_preload(){
	// Options:
	// 	- Imgur link
	// 	- Tweet
	// 	- Save as SVG

	//Get canvas info
	var $container = $('#lastwave'),
        // Canvg requires trimmed content
        content = $container.html().trim(),
        canvas = document.getElementById('svg-canvas');

    // Draw svg on canvas
    canvg(canvas, content);
	$('svg-canvas').empty();

	var svg = document.getElementById("lastwave").getElementsByTagName("svg")[0];
	//Update graph_data
	//if(type=="imgur"){
	graph_data.data_uri = canvas.toDataURL('image/png');
	//} else if(type=="svg"){
	graph_data.svg_data = (new XMLSerializer).serializeToString(svg);

	graph_data.base64 = Base64.encode(graph_data.svg_data);
 	$("#svg_dl").html($("<a href-lang='image/svg+xml' href='data:image/svg+xml;base64,\n"+graph_data.base64+"' title='file.svg' download='svg.svg'><button class='btn btn-primary'>Download vectorized SVG</button></a>"));
	//}
	togglediv("#sharing_options",true);
	togglediv("#share_preload",false);
}

/*function pngconvert(){
    var $container = $('#lastwave'),
        // Canvg requires trimmed content
        content = $container.html().trim(),
        canvas = document.getElementById('svg-canvas');

    // Draw svg on canvas
    canvg(canvas, content);
	$('svg-canvas').empty();
    // Change img be SVG representation
    var theImage = canvas.toDataURL('image/png');

	$('#lastwave').html('<img id="svg-img" />');
	
    togglediv("#edit_canvas",false);
    
    $('#svg-img').attr('src', theImage);
}*/

function imgur_upload(){
	if(graph_data.imgur_link==""){
		togglediv("#loading",true);
		$("#progresstext").html("Uploading to imgur...");
		$("#imgur_upload").css("width","100%");


		// upload to imgur using jquery/CORS
	    // https://developer.mozilla.org/En/HTTP_access_control
	    $.ajax({
	        url: 'https://api.imgur.com/3/image',
	        type: 'POST',
	        headers: {
	        	'Authorization': 'Client-ID cb42de2f8034d3c'
	    	},
	        data: {
	            type: 'base64',
	            name: 'wave.png',
	            title: graph_options.user+'\'s LastWave',
	            description: 'Make your own at savas.ca/lastwave!',
	            image: graph_data.data_uri.split(',')[1]
	        },
	        dataType: 'json'
	    }).success(function(data) {
	    	togglediv("#loading",false);
	    	graph_data.imgur_link = data.data.link;
	    	$("#imgur_upload").css("width","0%");
	    	$('#svg-img').attr('src', data.data.link);
	    	$("#imgur_data").html("<br/><br/><input type='text' value='http://www.imgur.com/"+data.data.id+"' onclick='this.setSelectionRange(0, this.value.length)' readonly>")
	    	add_to_gallery();
	    }).error(function() {
	        alert('Unable to reach Imgur, Sorry :(');
	    	$('#svg-img').attr('src', theImage);
	    });
	} else {
		alert("You've already uploaded the image to imgur!");
	}
}

function twitter_share(){
	if(graph_data.imgur_link == ""){
		togglediv("#loading",true);
		$("#progresstext").html("Uploading to imgur...");
		$("#imgur_upload").css("width","100%");


		// upload to imgur using jquery/CORS
	    // https://developer.mozilla.org/En/HTTP_access_control
	    $.ajax({
	        url: 'https://api.imgur.com/3/image',
	        type: 'POST',
	        headers: {
	        	'Authorization': 'Client-ID cb42de2f8034d3c'
	    	},
	        data: {
	            type: 'base64',
	            name: 'wave.png',
	            title: graph_options.user+'\'s LastWave',
	            description: 'Make your own at savas.ca/lastwave!',
	            image: graph_data.data_uri.split(',')[1]
	        },
	        dataType: 'json'
	    }).success(function(data) {		
	    	togglediv("#loading",false);
	    	graph_data.imgur_link = data.data.link;
	    	$("#imgur_upload").css("width","0%");
	    	$('#svg-img').attr('src', data.data.link);
	    	$("#imgur_data").html("<input type='text' value='http://www.imgur.com/"+data.data.id+"' onclick='this.setSelectionRange(0, this.value.length)' readonly>")
			add_to_gallery();
			var msg_text = "Check out my Listening History! "+graph_data.imgur_link+" Made with LastWave at savas.ca/lastwave";
			window.open("https://twitter.com/intent/tweet?text="+msg_text+"&hashtags=lastwave");
	    }).error(function() {
	        alert('Unable to reach Imgur, Sorry :(');
	    	$('#svg-img').attr('src', theImage);
	    });
	} else {
	    	$("#imgur_upload").css("width","0%");
	    	$('#svg-img').attr('src', graph_data.imgur_link);
	    	$("#imgur_data").html("<input type='text' value='"+graph_data.imgur_link+"' onclick='this.setSelectionRange(0, this.value.length)' readonly>")
			var msg_text = "Check out my Listening History! "+graph_data.imgur_link+" Made with LastWave at savas.ca/lastwave";
			window.open("https://twitter.com/intent/tweet?text="+msg_text+"&hashtags=lastwave");
	}

}

function swapScheme(s){
	if(s == "Custom"){
		togglediv("#graph_options",true);
	} else {
		togglediv("#graph_options",false);
	}
}

function show_options(){
	togglediv("#box_1",true);
	togglediv("#box_2",false);
	togglediv("#share_preload",true);
	togglediv("#sharing_options",false);
	togglediv("#imgur_data",false);
}

function switchlayout(){
	if(graph_options.normalize){
		graph_options.normalize = false;
	} else {
		graph_options.normalize = true;
	}
	parseXML();
}

function addWatermark(){
	var watermark = "savas.ca/lastwave";
	var watermark_height = graph.height*0.03/0.90;
	var watermark_width = watermark.width(watermark_height+"px Lucida Sans Unicode");

	d3.select("#lastwave").select("svg").append("text")
		.text(watermark)
		.attr("x",graph.width-watermark_width)
		.attr("y",graph.height/0.90)
		.attr("font-size",watermark_height)
		.attr("fill","#888")
		.attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif")
		.transition().style("opacity", 0.5);

}

function generateHue(hex1,hex2,colorcount,continuous){

	var c1 = hexToRgb(hex1);
	var c2 = hexToRgb(hex2);

	var dr = (c2.r-c1.r)/colorcount;
	var dg = (c2.g-c1.g)/colorcount;
	var db = (c2.b-c1.b)/colorcount;

	var colorscheme = [];

	for(var c=0;c<colorcount;c++){
		colorscheme.push(rgbToHex(parseInt(c1.r+(dr*c)),parseInt(c1.g+(dg*c)),parseInt(c1.b+(db*c))));
	}


	if(!continuous){
		return shuffle_array(colorscheme);
	} else {
		return colorscheme
	}


}

function getRatio(type){
	var maxy0 = 0;
	for(r=0;r<graph_data.series_data[graph_data.artists_order.length-1].stack.length;r++){
		if((graph_data.series_data[graph_data.artists_order.length-1].stack[r].y0+graph_data.series_data[graph_data.artists_order.length-1].stack[r].y) > maxy0){
			maxy0 = graph_data.series_data[graph_data.artists_order.length-1].stack[r].y0+graph_data.series_data[graph_data.artists_order.length-1].stack[r].y;
		}
	}

	//Get ratios
	var yratio = graph_options.graph_height/maxy0;
	var xratio = graph_options.graph_width/(graph_data.series_data[0].stack.length-1);
	return [xratio,yratio][type];
}

//TODO
/*

*/

function round_week(n){
	if(n > 0)
        return Math.ceil(n/604800.0) * 604800;
    else if( n < 0)
        return Math.floor(n/604800.0) * 604800;
    else
        return 604800;
}

function round_month(n){
	if(n > 0)
        return Math.ceil(n/2629743.0) * 2629743;
    else if( n < 0)
        return Math.floor(n/2629743.0) * 2629743;
    else
        return 2629743;
}

String.prototype.width = function(font) {
  var f = font,
      o = $('<div>' + this + '</div>')
            .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
            .appendTo($('body')),
      w = o.width();

  o.remove();

  return w;
}
String.prototype.height = function(font) {
  var f = font,
      o = $('<div>' + this + '</div>')
            .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
            .appendTo($('body')),
      w = o.height();

  o.remove();

  return w;
}


String.prototype.slope = function(font) {
  var f = "24px "+font,
      o = $('<div>' + this + '</div>')
            .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
            .appendTo($('body')),
      w = o.width();

  o.remove();

  return f.split("px")[0]/w;
}

Number.prototype.isBetween  = function (a, b, inclusive) {
    var min = Math.min.apply(Math, [a,b]),
        max = Math.max.apply(Math, [a,b]);
    return inclusive ? this >= min && this <= max : this > min && this < max;
};

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function isEmpty(map) {
   for(var key in map) {
      if (map.hasOwnProperty(key)) {
         return false;
      }
   }
   return true;
}

function shuffle_array(o){ //v1.0
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

//Bootstrap functionality
function inputFocus(i){
    if(i.value==i.defaultValue){ i.value="";}
}
function inputBlur(i){
    if(i.value==""){ i.value=i.defaultValue;}
}

//Shows/hides divs
function togglediv(id,state) {
	if ($(id).hasClass('shown') && state && id=="#graph_options" || !state) {
    	$(id).removeClass('shown').addClass('unshown');
	} else if(state){
    	$(id).removeClass('unshown').addClass('shown');
    }
}


//Adds the imgur link to our SQL database so that it will be displayed in the gallery. Future improvements could be saving the actual SVG so it can be displayed in high def
function add_to_gallery(){
	$.ajax({
	  type: "POST",
	  url: "http://savas.ca/lastwave/add_img.php",
	  dataType: 'json',
	  data: {
	  	'user':graph_options.user,
	  	'img_url':graph_data.imgur_link,
	  	'weeks': graph_options.total_weeks,
	  	'artistcount': graph_data.artists_order.length
	  }
	}).success(function(data){
	  	console.log(data);
	  });
}


//http://stackoverflow.com/questions/2483919/how-to-save-svg-canvas-to-local-filesystem
//Base 64
var Base64 = {
 
    // private property
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
 
    // public method for encoding
    encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;
 
        input = Base64._utf8_encode(input);
 
        while (i < input.length) {
 
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
 
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
 
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
 
            output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
 
        }
 
        return output;
    },
 
    // public method for decoding
    decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
 
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
 
        while (i < input.length) {
 
            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));
 
            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;
 
            output = output + String.fromCharCode(chr1);
 
            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }
 
        }
 
        output = Base64._utf8_decode(output);
 
        return output;
 
    },
 
    // private method for UTF-8 encoding
    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";
 
        for (var n = 0; n < string.length; n++) {
 
            var c = string.charCodeAt(n);
 
            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
 
        }
 
        return utftext;
    },
 
    // private method for UTF-8 decoding
    _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;
 
        while ( i < utftext.length ) {
 
            c = utftext.charCodeAt(i);
 
            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
 
        }
 
        return string;
    }
 
}
