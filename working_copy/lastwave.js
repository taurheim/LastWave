//Created by Nikolai Savas 2014
/*
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
	"font_color": "black",
	"font_name": "Arial",
	"graph_type": "Wiggle",
	"time_start": 0,
	"time_end": 0,
	"min_playcount": 0,
	"total_weeks": 0,
	"palette": 0
};

//Calculated
var graph_data = {
	"userdata": {},
	"week_XML": [],
	"time_span": [],
	"series_data": [],
	"artists_order": []
}


//For testing purposes
var test_artist = "Cage the Elephant";


//Initialize datepickers, convert buttons
  
$(document).ready(function() {
	$("#save_as_svg").click(function() { submit_download_form("svg"); });
	$("#save_as_png").click(function() { pngconvert(); });
	$("#start_date").datepicker();
	$("#end_date").datepicker();
});

function artist_data(){
	this.name = "";
	this.data = [];
	this.crit_points = [];
	this.fontsize = 100;
}

function line(m,b){
	//Slope
	this.m = m;

	//y-intercept
	this.b = b;
}

function Point(x,y){
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
	this.A = new line();
	this.B = new line();
	this.C = new line();
	this.D = new line();
	this.topleft = new Point();
	this.topright = new Point();
	this.btmleft = new Point();
	this.btmright = new Point();
	this.origin = new Point();
}


//On the submit button being clicked
function submitWave(){
	//Number of minimum Plays
	graph_options.min_playcount = document.getElementById('plays').value;
	if(graph_options.min_playcount < 5){
		alert("Minimum number of plays to count is 5");
		return false;
	}

	//Graph Dimensions
	graph_options.graph_height = parseInt(document.getElementById("height").value);
	graph_options.graph_width = parseInt(document.getElementById("width").value);
	if(graph_options.graph_width>25000 || graph_options.graph_height>10000){
		alert("Caution: Choosing a graph this size may cause browser problems");
	}

	//Other options
	graph_options.font_name = document.getElementById("font_name").value;
	graph_options.graph_type = document.getElementById("graph_type").value;
	graph_options.showartistnames = document.getElementById("artist_names").checked;
	graph_options.show_months = document.getElementById("show_months").checked
	graph_options.normalize = document.getElementById("normalize").checked;

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

	graph_options.total_weeks = total_weeks;

	//If the data set hasn't changed, then simply re-parse the data and re-draw the graph
	if(time_start == graph_options.time_start && 
		time_end == graph_options.time_end && 
		document.getElementById('user').value == graph_options.user)
	{
		graph_options.time_start = time_start;
		graph_options.time_end = time_end;
		parseXML();
	} else {
		graph_options.time_start = time_start;
		graph_options.time_end = time_end;
		loadXML(document.getElementById('user').value);
	}

	//Hide settings box

	$('#box_1').css("display","none");
}

function resetXML(){
	graph_data.userdata = {};
	graph_data.week_XML = [];
	graph_data.time_span = [];
	graph_data.series_data = [];
	graph_data.artists_order = [];
	$('#loading').css("display","block");
}

function loadXML(selected_user) {
	resetXML();
	graph_options.user = selected_user;
	for(w=1;w<=graph_options.total_weeks;w++){
		get_week(selected_user,w);
	}
}

function get_week(user, weeknum){
	setTimeout( function() { 
		//Add a week to timer
		var week_start=graph_options.time_start+ (604800*(weeknum-1));
		var week_end=week_start + 604800;
		graph_data.time_span.push(week_start);

		//Get the data
		graph_data.week_XML.push(
			$.get("http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user="+user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from="+week_start+"&to="+week_end).fail(function() {$('#errors').append("Error loading Week "+weeknum+"<br/>")})
		);


		$('#loading').html("Loading week "+weeknum+" of "+total_weeks+"...<br/>");


		//If it's the last week, wait for the rest of them
		if(weeknum==graph_options.total_weeks){
				xmlwait();
		}

	}, 250*(weeknum-1));
	
}

function xmlwait() {
	$.when.apply(null,graph_data.week_XML).done(function() {
		$('#loading').append("All weeks loaded!");
		parseXML();
	})
}

function parseXML(){
	var artist_plays = 0;
	var artist_name = "";
	//Populates "userdata"
	graph_data.userdata= [];
	graph_data.series_data = [];
	graph_data.artists_order = [];

	//Run through every week, adding artists as we go
	$('#loading').html("Parsing XML...");

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

		//Run through every artist, adding to "userdata" as we go
		for(i=0;i<artist_count;i++){
			
			//Get each artist name,playcount
			artist_name = week_data.getElementsByTagName("name")[i].childNodes[0].nodeValue;
			artist_plays = week_data.getElementsByTagName("playcount")[i].childNodes[0].nodeValue;

			//If our artist has enough plays
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
	/**/
	//Now that we've got all of our data, draw the wave
	$('#loading').html("Finished parsing XML...");
	drawLastWave();
}

function calculate_critical_points(){
	//Calculate Critical Points
	//Strategy:
	// Run through each non-zero week and find maximum value
	// Remove all weeks that are within a certain bound
	// Repeat until there are no remaining weeks to be maxes

	for(artist in graph_data.userdata){
		graph_data.userdata[artist].crit_points = [];
		var full_weeks = [];
		for(i=0;i<graph_options.total_weeks;i++){
			if(graph_data.userdata[artist].data[i+1][1]>0){
				full_weeks.push(i+1);
			}
		}
		while(full_weeks.length>0){
			var max_point = [0,0];
			for(week in full_weeks){
				if(max_point[1]<graph_data.userdata[artist].data[full_weeks[week]][1]){
					max_point = graph_data.userdata[artist].data[full_weeks[week]];
				}
			}
			graph_data.userdata[artist].crit_points.push(graph_data.userdata[artist].data[max_point[0]]);

			//Remove all weeks within 2 of the critical point
			var threshold = 6;
			for(w=max_point[0]-threshold;w<=max_point[0]+threshold;w++){
				var index = full_weeks.indexOf(w);
				if(index>-1){
					full_weeks.splice(index, 1);
				}
			}
		}
	}
}

function drawLastWave(){
	//Mother function, this is where it all happens

	$('#loading').html("Drawing Wave...");
	document.getElementById("lastwave").innerHTML = "";

	//Palette is the scheme (selected in the dropdown). We use this to make the graph itself.
	graph_options.palette = new Rickshaw.Color.Palette( { scheme: scheme.value } );
	if(scheme.value=="spectrum2001") font_color = "white";

	graph_data.series_data = populateWave();

	graph = new Rickshaw.Graph( {
		element: document.querySelector("#lastwave"), 
		width: graph_options.graph_width, 
		height: graph_options.graph_height, 
		renderer: 'area',
		offset: graph_options.graph_type,
		stroke: true,
		preserve: true,
		series: graph_data.series_data
	});

	graph.render();

	if(graph_options.show_months){
		drawMonths();
	}

	if(graph_options.showartistnames){
		drawNames();
	}
	
	$('#loading').html("Wave Complete!");
	$('#box_2').css("display","block");
	$('#loading').css("display","none");
	addWatermark();

}

function populateWave(){
	var series_data = [];
	$('#loading').html("Populating Wave...");
	//Order the artists
	for(artist in graph_data.userdata){
		graph_data.artists_order.push(graph_data.userdata[artist].name);
	}

	//If "normalize" has been selected, order them so that the largest playcount is in the center
	if(graph_options.normalize){
		var firsthalf = graph_data.artists_order.slice(0, graph_data.artists_order.length /2);
		var secondhalf = graph_data.artists_order.slice(graph_data.artists_order.length/2,graph_data.artists_order.length);

		firsthalf.sort(function (a,b){
			return graph_data.userdata[a].crit_points[0][1]-graph_data.userdata[b].crit_points[0][1];
		});
		secondhalf.sort(function (a,b){
			return graph_data.userdata[b].crit_points[0][1]-graph_data.userdata[a].crit_points[0][1];
		});
		graph_data.artists_order = firsthalf.concat(secondhalf);
	}

	//Populate series data
	for(a=0;a<graph_data.artists_order.length;a++){
		//Artist name
		var selected_artist = graph_data.artists_order[a];
		
		//Hold all the coordinate information in this temporary variable
		var tempdata = [];
		
		//Populate tempdata
		for(i=1;i<=graph_options.total_weeks;i++){
			if(graph_data.userdata[selected_artist].data[i] != undefined){
				tempdata[i-1] = { x: graph_data.userdata[selected_artist].data[i][0], y: graph_data.userdata[selected_artist].data[i][1]}
			}
		}
		
		//Populate series_data (each part is an artist)
		series_data[a]= {color:graph_options.palette.color(),name: selected_artist,data: tempdata};
		
		}
	return series_data;
}

function drawMonths(){
		//x ratio
		var xratio = graph.width/(graph.series[0].stack.length-1);

		d3.select("#lastwave").select("svg").select("g").append("g").attr("id", "Months");
		//Push all months to background

		//Set up background
		var months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

		//console.log("Total Distance:"+(graph_options.time_end-graph_options.time_start));


		//If our rounded month is behind our start time, skip it
		for(t=graph_options.time_start;t<graph_options.time_end;t+=2629743){
			var month = round_month(t);
			month_name = months[new Date((month*1000)+604800000).getMonth()];

			if(month<graph_options.time_start){
				month+=2629743;
			}
			if(month>graph_options.time_end){
				break;
			}

			var rah = (month-graph_options.time_start)/(graph_options.time_end-graph_options.time_start);
			rah*= graph.width;
			/*
			console.log(month_name + " " + rah);
			console.log(new Date(month*1000));*/

			d3.select("#lastwave").select("svg").select("#Months").append("line").attr("x1",rah).attr("y1","0").attr("x2",rah).attr("y2",graph.height-40).attr("style","stroke:rgb(100,100,100);stroke-width:5;stroke-opacity: 0.2;");
			d3.select("#lastwave").select("svg").select("#Months").append("text").text(month_name).attr("x",rah - month_name.width("20px Lucida Sans Unicode")/2).attr("y",graph.height-20).attr("font-size",20).attr("fill","#AAA").attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif");
		}
}

function drawNames(){
	$('#loading').html("Drawing Artist Names...");
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
				((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m>=0)&&(cp.D.m<=0)) ||
				((cp.A.m<=0)&&(cp.B.m>=0)&&(cp.C.m<0)&&(cp.D.m>0))
			){
				//Type "W"
				label = draw_W(cp,artist_name);
				//console.log(artist_name+" - W");
			}
			else if(
				((cp.A.m<=0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m<=0))||
				((cp.A.m>0)&&(cp.B.m>=0)&&(cp.C.m>=0)&&(cp.D.m>0))
			){
				//Type "X"
				label = draw_X(cp,artist_name);
				//console.log(artist_name+" - X");
			}
			else if(
				(cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m>=0)&&(cp.D.m>0)||
				(cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m<=0)||
				(cp.A.m<=0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m>0)||
				(cp.A.m>0)&&(cp.B.m>=0)&&(cp.C.m<0)&&(cp.D.m>0)
			){
				//Type "Y"
				label = draw_Y(cp,artist_name);
				//console.log(artist_name+" - Y");
			}
			else if(
				(cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m>0)
			){
				//Type "Z"
				label = draw_Z(cp,artist_name);
				//console.log(artist_name+" - Z");
			} else {
				console.log("Error Loading Artist: "+artist_name);
				continue;
			}
			


			if(!label || label.fontsize<8){
				//console.log(artist_name +" failed with a font size of "+fontsize);
				continue;
			}
			d3.select("#lastwave").select("svg").append("text").text(artist_name).attr("x",label.x).attr("y",label.y).attr("font-size",label.fontsize).attr("fill",graph_options.font_color).attr("font-family",graph_options.font_name);
		
		}
	}
}

function populate_lines(){

	var crit = new Crit_Point();
	for(i=0;i<graph_data.artists_order.length;i++){
		var artist_name = graph_data.artists_order[i];
		for(pt in graph_data.userdata[artist_name].crit_points){
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
			crit.origin = graph_data.userdata[artist_name].crit_points[pt];
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
			
			if((x_point)==total_weeks){
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

			//Slopes
			crit.A.m = (crit.q.y - crit.topleft.y)/(crit.q.x - crit.topleft.x);
			crit.B.m = (crit.topright.y - crit.q.y)/(crit.topright.x - crit.q.x);
			crit.C.m = (crit.r.y - crit.btmleft.y)/(crit.r.x - crit.btmleft.x);
			crit.D.m = (crit.btmright.y - crit.r.y)/(crit.btmright.x - crit.r.x);

			//Y-intercepts
			crit.A.b = crit.q.y - crit.A.m*crit.q.x;
			crit.B.b = crit.q.y - crit.B.m*crit.q.x;
			crit.C.b = crit.r.y - crit.C.m*crit.r.x;
			crit.D.b = crit.r.y - crit.D.m*crit.r.x;

			//Round
			crit.A.m = parseInt(crit.A.m*10000000000)/10000000000;
			crit.B.m = parseInt(crit.B.m*10000000000)/10000000000;
			crit.C.m = parseInt(crit.C.m*10000000000)/10000000000;
			crit.D.m = parseInt(crit.D.m*10000000000)/10000000000;

			graph_data.userdata[artist_name].crit_points[pt] = crit;

			if(artist_name==test_artist){
				d3.select("#lastwave").select("svg").append("line").attr("x1",crit.topleft.x).attr("y1",graph_options.graph_height-crit.topleft.y).attr("x2",crit.q.x).attr("y2",graph_options.graph_height-crit.q.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").append("line").attr("x1",crit.btmleft.x).attr("y1",graph_options.graph_height-crit.btmleft.y).attr("x2",crit.r.x).attr("y2",graph_options.graph_height-crit.r.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").append("line").attr("x1",crit.q.x).attr("y1",graph_options.graph_height-crit.q.y).attr("x2",crit.topright.x).attr("y2",graph_options.graph_height-crit.topright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#lastwave").select("svg").append("line").attr("x1",crit.r.x).attr("y1",graph_options.graph_height-crit.r.y).attr("x2",crit.btmright.x).attr("y2",graph_options.graph_height-crit.btmright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				//d3.select("#lastwave").select("svg").append("circle").attr("cx",crit.q.x).attr("cy",graph_options.graph_height-crit.q.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
				
			}
		}
	}
}

function draw_W(cp,artist_name){
	//cp is the critical point, should contain all information necessary.
	var fontsize = 5;
	if(cp.A.m>0){ // w2
		var btm_bound = cp.r.y;
		while(true){
			//Find the bottom bound of our textbox
			btm_bound = cp.r.y + fontsize;

			var coll_left = (btm_bound - cp.A.b)/cp.A.m;
			if(coll_left<cp.topleft.x) coll_left=cp.topleft.x;

			var coll_right = (btm_bound - cp.B.b)/cp.B.m;
			if(coll_right>cp.topright.x) coll_right=cp.topright.x;

			var boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
			if((coll_right-coll_left)>(cp.topright.x-cp.topleft.x)){
				coll_left = cp.topleft.x;
				fontsize = cp.topleft.y - coll_left.y;
				break;
			} else if((coll_right-coll_left)>boxWidth){
				fontsize+=2;
			} else {
				break;
			}
		}
		if(artist_name.height(fontsize+"px "+font_name)>cp.q.y-cp.r.y){
			//TODO
			//Change this so that it will keep subtracting font sizes until it fits
			fontsize = cp.q.y-cp.r.y;
		}
		fontsize*=0.75;
		y_value_for_max_point = graph_options.graph_height - btm_bound + artist_name.height(fontsize+"px "+graph_options.font_name)/2;
	} else { //w1
		//console.log("\\\/"+artist_name);
		var top_bound = cp.q.y;
		while(true){
			//Find the bottom bound of our textbox
			var btm_bound = cp.q.y - fontsize;

			var coll_left = (btm_bound - cp.C.b)/cp.C.m;
			if(coll_left<cp.topleft.x) coll_left=cp.topleft.x;

			var coll_right = (btm_bound - cp.D.b)/cp.D.m;
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
		fontsize*=0.9;
		y_value_for_max_point = graph_options.graph_height - top_bound + artist_name.height(fontsize+"px "+graph_options.font_name);
	}
	boxWidth = artist_name.width(fontsize+"px "+graph_options.font_name);
	x_value_for_max_point = coll_left;//+boxWidth*0.15;
	/*if(fontsize==5){
		console.log("Skipping "+artist_name);
		continue;
	}*/
	//Extra positioning to make up for curves
	if(cp.C.m<0.5 && cp.C.m>0 && cp.D.m<-1.5){
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
		if(cp.A.m>=0){
			coll_left = (v-cp.A.b)/cp.A.m;
			coll_right = (v-cp.D.b)/cp.D.m;
		} else {
			coll_left = (v-cp.C.b)/cp.C.m;
			coll_right = (v-cp.B.b)/cp.B.m;
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
	var ctrpt = {"x": maxWidth[2] + maxWidth[0]/2, "y": maxWidth[1]};
	var mDiag = artist_name.slope(graph_options.font_name);
	if(cp.A.m>0) mDiag*=-1;
	var bDiag = ctrpt.y - mDiag*ctrpt.x;
	
	//Now find the points of intersection of diag with all of the other lines x = b2 - b1/m1 - m2
	//A
	var diag_A = {"x" : (bDiag-cp.A.b)/(cp.A.m - mDiag), "y" : mDiag*((bDiag-cp.A.b)/(cp.A.m - mDiag)) + bDiag};
	//B
	var diag_B = {"x" : (bDiag-cp.B.b)/(cp.B.m - mDiag), "y" : mDiag*((bDiag-cp.B.b)/(cp.B.m - mDiag)) + bDiag};
	//C
	var diag_C = {"x" : (bDiag-cp.C.b)/(cp.C.m - mDiag), "y" : mDiag*((bDiag-cp.C.b)/(cp.C.m - mDiag)) + bDiag};
	//D
	var diag_D = {"x" : (bDiag-cp.D.b)/(cp.D.m - mDiag), "y" : mDiag*((bDiag-cp.D.b)/(cp.D.m - mDiag)) + bDiag};
	
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
		console.log("Error labelling "+artist_name);
		return false;
	}
	fontsize = Math.abs(parseInt((top_collision.x-btm_collision.x)*artist_name.slope()));
	if(fontsize>cp.q.y-cp.r.y){
		fontsize = Math.abs(cp.q.y-cp.r.y);
	}
	
	fontsize*=0.9;
	var boxHeight = artist_name.height(fontsize+"px "+font_name);
	var boxWidth = artist_name.width(fontsize+"px "+font_name);
	
	//Which x/y values we pick is based on whether we have the graph getting steeper/shallower after a&b

	//Steeper
	if(cp.A.m<0 && cp.B.m<cp.A.m && cp.D.m<cp.C.m){
		console.log("trigger "+ artist_name)
		x_value_for_max_point = Math.max(top_collision.x,btm_collision.x) - boxWidth;
		y_value_for_max_point = graph.height - top_collision.y + boxHeight*0.3;
	} else {
		x_value_for_max_point = Math.min(top_collision.x,btm_collision.x);//ctrpt.x - boxWidth/2;
		y_value_for_max_point = graph_options.graph_height-btm_collision.y;//graph.height - maxWidth[1] + boxHeight/2;
	}
	//There's no way I can make an estimate for this
	if((Math.abs(cp.A.m+cp.C.m)<0.25 && Math.abs(cp.B.m+cp.D.m)>2) || (Math.abs(cp.B.m+cp.D.m)<0.25 && Math.abs(cp.A.m+cp.C.m)>2) ){
		console.log("Impossible to estimate "+artist_name);
	}
	if(artist_name==test_artist){
		console.log(coll_right);
		console.log(maxWidth);
		//Green line
		d3.select("#lastwave").select("svg").append("line").attr("x1",maxWidth[2]).attr("y1",graph_options.graph_height-maxWidth[1]).attr("x2",maxWidth[2]+maxWidth[0]).attr("y2",graph.height-maxWidth[1]).attr("style","stroke:rgb(0,255,0);stroke-width:1");
		d3.select("#lastwave").select("svg").append("circle").attr("cx",top_collision.x).attr("cy",graph_options.graph_height - top_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
		d3.select("#lastwave").select("svg").append("circle").attr("cx",btm_collision.x).attr("cy",graph_options.graph_height - btm_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
		d3.select("#lastwave").select("svg").append("circle").attr("cx",ctrpt.x).attr("cy",graph_options.graph_height - ctrpt.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
	
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
	var offset_sign; //In step 3, we need to offset. If our start point is a, we offset downwards (-1), if it is b, we offset upwards (1)
	var slope_sign; //1 or -1
	var slope = artist_name.slope(); //slope of initial line
	var mO; //This is the opposite side line
	var bO;
	var mV; //This line is horizontally opposite to O
	var bV;
	var mU; //This line is vertically opposite to V
	var x_value_for_max_point;
	var y_value_for_max_point;
	var intersect1;
	var intersect2;
	//var bU;
	var offset = 0; //This variable is helpful to move the text to give room for curved edges (we pretend like we're only dealing with flat in all the calculations)
	if(cp.A.m<=0 && cp.B.m<0 || cp.A.m>=0 && cp.B.m>=0) {
		start_point = cp.q;
		offset_sign = -1;
		if(cp.A.m>0 || cp.A.m==0 && cp.B.m>0){ //Opposite line: D -> C ^ A
			//console.log("a");
			slope_sign = -1;
			mO = cp.D.m;
			bO = cp.D.b;
			mV = cp.C.m;
			bV = cp.C.b;
			mU = cp.A.m;
			bU = cp.A.b;
		}
		if(cp.A.m<0 || cp.A.m==0 && cp.B.m<0){ //Opposite line: C -> D ^ B
			//console.log("b");
			slope_sign = 1;
			mO = cp.C.m;
			bO = cp.C.b;
			mV = cp.D.m;
			bV = cp.D.b;
			mU = cp.B.m;
			bU = cp.B.b;
		}
	} else if(cp.C.m<=0 && cp.D.m<0 || cp.C.m>=0 && cp.D.m>0) {
		start_point = cp.r;
		offset_sign = 1;
		if(cp.C.m>=0){ //Opposite line: A -> B ^ D
			//console.log("c");
			slope_sign = -1;
			mO = cp.A.m;
			bO = cp.A.b;
			mV = cp.B.m;
			bV = cp.B.b;
			mU = cp.D.m;
			bU = cp.D.b;
			if(cp.C.m<0.2 && cp.D.m>1){
				offset=1;
			}
		}
		if(cp.C.m<0){ //Opposite line: B -> A ^ C
			//console.log("d");
			slope_sign = 1;
			mO = cp.B.m;
			bO = cp.B.b;
			mV = cp.A.m;
			bV = cp.A.b;
			mU = cp.C.m;
			bU = cp.C.b;
			if(cp.C.m>-0.2 && cp.D.m<-1){
				offset=1;
			}
		}
	} else {
		console.log("Really weird error - "+artist_name);
		console.log(artist_name + " - y" + " - " + cp.A.m + "," + cp.B.m + "," + cp.C.m + "," + cp.D.m);
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
		| (  ____ /			 |
		|  /				 |
		   
		*/
		count++;
		mQ = slope*slope_sign;
		bQ = start_point.y - mQ*start_point.x;
		
		//First check if Q intersects with V
		if(
			//y1
			(((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m>=0)&&(cp.D.m>0)) && ((bV-bQ)/(mQ-mV) < cp.topright.x) && (bV-bQ)/(mQ-mV) > a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV > cp.topright.y)
			||
			//y2
			(((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m<=0)) && ((bV-bQ)/(mQ-mV) > cp.topleft.x) && (bV-bQ)/(mQ-mV) < a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV > cp.topleft.y)
			||
			//y3
			(((cp.A.m<=0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m>0)) && ((bV-bQ)/(mQ-mV) < cp.topright.x) && (bV-bQ)/(mQ-mV) > a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV < cp.btmright.y)
			||
			//y4
			(((cp.A.m>0)&&(cp.B.m>=0)&&(cp.C.m<0)&&(cp.D.m>0)) && ((bV-bQ)/(mQ-mV) > cp.topleft.x) && (bV-bQ)/(mQ-mV) < a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV < cp.btmleft.y)
		 ) {
			start_point = previous_start_point;
			break;
		 } else {
		
			//Find intersection between Q and O
			//Intersection: x = (b2-b1)/(m1-m2). line 1 = Q, line 2 = O
			intersect1 = {"x": (bO - bQ)/(mQ - mO), "y": ((mO)*(bO - bQ)/(mQ - mO))+bO};
		}
		
		
		//New line going cp.A.cp.C.bkwards (from now on referred to as X)
		mX = slope*slope_sign*-1;
		bX = start_point.y - mX*intersect1.x;
		
		//Find intersection between X and V
		
		//First check if X collides with line U before it collides with V
		if(
			//y1
			(((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m>=0)&&(cp.D.m>0)) && ((bU-bX)/(mX-mU) < cp.topright.x) && (bU-bX)/(mX-mU) > a.x && ((mU)*(bU-bX)/(mX-mU))+bU < cp.topright.y)
			||
			//y2
			(((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m<=0)) && ((bU-bX)/(mX-mU) > cp.topleft.x) && (bU-bX)/(mX-mU) < a.x && ((mU)*(bU-bX)/(mX-mU))+bU < cp.topleft.y)
			||
			//y3
			(((cp.A.m<=0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m>0)) && ((bU-bX)/(mX-mU) < cp.topright.x) && (bU-bX)/(mX-mU) > a.x && ((mU)*(bU-bX)/(mX-mU))+bU > cp.btmright.y)
			||
			//y4
			(((cp.A.m>0)&&(cp.B.m>=0)&&(cp.C.m<0)&&(cp.D.m>0)) && ((bU-bX)/(mX-mU) > cp.topleft.x) && (bU-bX)/(mX-mU) < a.x && ((mU)*(bU-bX)/(mX-mU))+bU > cp.btmleft.y)
		 ) {
			intersect2 = { "x": (bU - bX)/(mX - mU), "y": ((mU)*(bU - bX)/(mX - mU))+bU};
		 } else {
			//Intersection x = (b2-b1)/(m1-m2). line 1 = X, line 2 = V
			intersect2 = {"x": (bV - bX)/(mX - mV), "y": ((mV)*(bV - bX)/(mX - mV))+bV};
		}
		if(artist_name==test_artist){
			//green line (start_point -> intersect1)
			d3.select("#lastwave").select("svg").append("line").attr("x1",start_point.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect1.x).attr("y2",graph_options.graph_height-intersect1.y).attr("style","stroke:rgb(0,255,0);stroke-width:1");
			//blue line  (intersect1 -> intersect2) (X)
			d3.select("#lastwave").select("svg").append("line").attr("x1",intersect1.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect2.x).attr("y2",graph_options.graph_height-intersect2.y).attr("style","stroke:rgb(0,0,255);stroke-width:1");
			
			//intersect2
			d3.select("#lastwave").select("svg").append("circle").attr("cx",intersect2.x).attr("cy",graph_options.graph_height-intersect2.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
		}
		
		//Check if we're out of our bounds
		if(intersect2.x < cp.topleft.x || intersect2.x > cp.topright.x){
			intersect2.x = (intersect2.y - bU)/mU;
		}
		
		previous_start_point = start_point;

		if(intersect2.x<cp.topleft.x){
			intersect2.x= cp.topleft.x;
		}
		if(intersect2.x>cp.topright.x){
			intersect2.x = cp.topright.x;
		}

		start_point = {"x": intersect2.x, "y": mU*intersect2.x + bU};
		
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
			console.log("Ran into problems trying to place label for "+artist_name+", Current font size at: "+Math.round(Math.abs(intersect1.y-previous_start_point.y))+"px");
			break;
		} else {
			//console.log(intersect1.y-previous_start_point.y);
		}
	}
	
	fontsize = Math.round(Math.abs(intersect1.y-previous_start_point.y));
	fontsize*= 0.8;
	
	//Pick value cp.A.bsed on type
						 
	//y1
	if((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m>=0)&&(cp.D.m>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph_options.graph_height - start_point.y;}
	//y2
	if((cp.A.m>0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m<=0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph_options.graph_height - previous_start_point.y;}
	//y3
	if((cp.A.m<=0)&&(cp.B.m<0)&&(cp.C.m<0)&&(cp.D.m>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph_options.graph_height - intersect1.y;}
	//y4
	if((cp.A.m>0)&&(cp.B.m>=0)&&(cp.C.m<0)&&(cp.D.m>0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph_options.graph_height - intersect1.y;}
	//x_value_for_max_point = cp.A.mth.min(start_point.x,intersect1.x,intersect2.x);
	
	//y_value_for_max_point = graph_options.graph_height - cp.A.mth.min(start_point.y,intersect1.y,intersect2.y);// - cp.A.mth.abs((  intersect2.y - start_point.y - artist_name.height(fontsize+"px "+graph_options.font_name) )/2);// - fontsize*offset;
	
	if(artist_name==test_artist){
			//black line (start_point -> intersect1)
			d3.select("#lastwave").select("svg").append("line").attr("x1",start_point.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect1.x).attr("y2",graph_options.graph_height-intersect1.y).attr("style","stroke:rgb(0,0,0);stroke-width:1");
			//white line  (intersect1 -> intersect2)
			d3.select("#lastwave").select("svg").append("line").attr("x1",intersect1.x).attr("y1",graph_options.graph_height-start_point.y).attr("x2",intersect2.x).attr("y2",graph_options.graph_height-intersect2.y).attr("style","stroke:rgb(255,255,255);stroke-width:1");
			//black dot - final resting point
			d3.select("#lastwave").select("svg").append("circle").attr("cx",x_value_for_max_point).attr("cy",y_value_for_max_point).attr("r",3).attr("stroke-width",5).attr("fill","black");
	}
	//Curve fixes

	//if C is flat and D is steep
	if(cp.C.m>-0.5 && cp.C.m<0.5 && cp.D.m<-0.9 && (y_value_for_max_point<(cp.r.y-Math.abs(cp.r.y-cp.q.y)))){
		//x_value_for_max_point += "W".width(fontsize+"px "+graph_options.font_name);
		y_value_for_max_point -= (.5*artist_name.height(fontsize+"px "+graph_options.font_name));
		//if(artist_name ==test_artist){
			console.log("[y]Correcting " + artist_name);
		//}
	}
	//}
	//fontsize = 25;
	
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
		coll_A = (boxTop-cp.A.b)/cp.A.m;
		coll_C = (boxTop-cp.C.b)/cp.C.m;
		coll_topleft = Math.max(coll_A,coll_C);
		if(coll_topleft<cp.topleft.x) coll_topleft = cp.topleft.x;
		
		coll_B = (boxTop-cp.B.b)/cp.B.m;
		coll_D = (boxTop-cp.D.b)/cp.D.m;
		coll_topright = Math.min(coll_B,coll_D);
		if(coll_topright>cp.topright.x) coll_topright = cp.topright.x;
		
		boxTopWidth = coll_topright-coll_topleft;
		
		//Bottom
		coll_A = (boxBottom-cp.A.b)/cp.A.m;
		coll_C = (boxBottom-cp.C.b)/cp.C.m;
		coll_btmleft = Math.max(coll_A,coll_C);
		if(coll_btmleft<cp.topleft.x) coll_btmleft = cp.topleft.x;
		
		coll_B = (boxBottom-cp.B.b)/cp.B.m;
		coll_D = (boxBottom-cp.D.b)/cp.D.m;
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

function submit_download_form(output_format)
{
	// Get the d3js SVG element
	var tmp = document.getElementById("lastwave");
	var svg = tmp.getElementsByTagName("svg")[0];
	// Extract the data as SVG text string
	var svg_xml = (new XMLSerializer).serializeToString(svg);

	// Submit the <FORM> to the server.
	// The result will be an attachment file to download.
	var form = document.getElementById("svgform");
	form['output_format'].value = output_format;
	form['data'].value = svg_xml ;
	form.submit();
}

function pngconvert(){
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
    $('#svg-img').attr('src', theImage);
	$('#box_1').css("display","none");
	
}

function show_options(){
	$('#box_1').css("display","block");
	$('#box_2').css("display","none");
}

function addWatermark(){
	var watermark = "savas.ca/lastwave";
	var watermark_height = graph.height*0.03;
	var watermark_width = watermark.width(watermark_height+"px Lucida Sans Unicode");

	d3.select("#lastwave").select("svg").append("text").text(watermark).attr("x",graph.width-watermark_width).attr("y",graph.height).attr("font-size",watermark_height).attr("fill","#000").attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif").transition().style("opacity", 0.5);

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