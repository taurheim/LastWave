function CreateWave(){
	loadXML(document.getElementById('user').value);
}
var userdata = {};
function loadXML(selected_user) {
	xmlhttp=new XMLHttpRequest();
	xmlhttp.open("GET","http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user="+selected_user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72",false);
	xmlhttp.send();
	userinfo = xmlhttp.responseXML;
	var time_start = round_week(userinfo.getElementsByTagName("registered")[0].getAttribute('unixtime'))-302400-604800;
	var time_end = time_start+604800;
	var current_time = round_week((new Date).getTime()/1000);

	//User Data variable. Store all the information here, then graph it.

	//Calculate how many weeks the user has been on last.fm (we're going to run through the loop for every week)
	var total_weeks = Math.ceil((current_time-time_start)/604800);

	//Run through every week, adding artists as we go
	for(w=1;w<total_weeks;w++){
		//Add a week to timer
		var week_start=time_start+ (604800*w);
		var week_end=week_start + 604800;
		
		
		//Get the week's data
		xmlhttp.open("GET","http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user="+selected_user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from="+week_start+"&to="+week_end,false);
		xmlhttp.send();
		week_data = xmlhttp.responseXML;
		
		//If there is an error, remove the point
		if(week_data.getElementsByTagName("lfm")[0].getAttribute("status") != "ok"){
			continue;
		}
		
		//Add an empty value for all artists (this will be overwritten if the artist doesn't get any plays in the current week)
		for (artist in userdata){
			userdata[artist][w] = [w,0];
		}
		
		//Get the number of artists with data this week
		artist_count = week_data.getElementsByTagName("artist").length;
		if(artist_count==0){
			document.write("Empty week");
		}
		//Run through every artist, adding to "userdata" as we go
		for(i=0;i<artist_count;i++){
		
			//Get each artist name,playcount
			artist_name = week_data.getElementsByTagName("name")[i].childNodes[0].nodeValue;
			artist_plays = week_data.getElementsByTagName("playcount")[i].childNodes[0].nodeValue;
			if((userdata[artist_name]!=undefined) || (parseInt(artist_plays)>=10)){
				if(userdata[artist_name] == undefined){
					//Add an artist if the artist didn't previously exist, fill all previous values with 0s
					userdata[artist_name] = [];
					for(n=1;n<=w;n++){
						userdata[artist_name][n] = [n,0];
					}
				}
				
				//Add the data to userdata
				userdata[artist_name][w] = [w,parseInt(artist_plays)];
				if(userdata[artist_name][0] == undefined || artist_plays>userdata[artist_name][0][1]){
					userdata[artist_name][0] = [w,parseInt(artist_plays)];
				}
			}
		}
	}
	drawLastWave();
}

function round_week(n){
if(n > 0)
        return Math.ceil(n/604800.0) * 604800;
    else if( n < 0)
        return Math.floor(n/604800.0) * 604800;
    else
        return 604800;
}

function submit_download_form(output_format)
{
	// Get the d3js SVG element
	var tmp = document.getElementById("ex1");
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

function create_d3js_drawing()
{
	d3.select("#randomize").on("click", function() {
		svg.selectAll(".little")
			.transition()
			.duration(750)
			.attr("cx", function() { return Math.random() * w; })
			.attr("cy", function() { return Math.random() * h; })
			.attr("fill", function() { return '#'+Math.floor(Math.random()*16777215).toString(16); });
		/* Random Hex Color in Javascript, from: http://paulirish.com/2009/random-hex-color-code-snippets/ */

		// Show the new SVG code
		show_svg_code();
		});
}

function show_svg_code()
{
	// Get the d3js SVG element
	var tmp  = document.getElementById("ex1");
	var svg = tmp.getElementsByTagName("svg")[0];

	// Extract the data as SVG text string
	var svg_xml = (new XMLSerializer).serializeToString(svg);

	//Optional: prettify the XML with proper indentations
	svg_xml = vkbeautify.xml(svg_xml);

	// Set the content of the <pre> element with the XML
	$("#svg_code").text(svg_xml);

	//Optional: Use Google-Code-Prettifier to add colors.
	prettyPrint();
}


$(document).ready(function() {
	create_d3js_drawing();

	// on first visit, randomize the positions & colors

	// Attached actions to the buttons
	$("#show_svg_code").click(function() { show_svg_code(); });

	$("#save_as_svg").click(function() { submit_download_form("svg"); });

	$("#save_as_pdf").click(function() { submit_download_form("pdf"); });

	$("#save_as_png").click(function() { submit_download_form("png"); });
});
var graph;
function drawLastWave() {
	var palette = new Rickshaw.Color.Palette( { scheme: scheme.value } );
	var include_artists = [];
	var artistnames = [];
	for(artist in userdata){
		include_artists.push(artist);
	}

	var series_data = [];

	for(a=0;a<include_artists.length;a++){
		//Artist name
		selected_artist = include_artists[a];
		
		//Hold all the coordinate information in this temporary variable
		var tempdata = [];
		
		//Populate tempdata
		for(i=1;i<userdata[selected_artist].length;i++){
			if(userdata[selected_artist][i] != undefined){
				tempdata[i-1] = { x: userdata[selected_artist][i][0], y: userdata[selected_artist][i][1]}
			}
		}
		
		//Populate series_data (each part is an artist)
		series_data[a]= {color:palette.color(),name: selected_artist,data: tempdata};
		
		}
	graph = new Rickshaw.Graph( {
		element: document.querySelector("#ex1"), 
		width: 3000, 
		height: 1500, 
		renderer: 'area',
		offset: 'silhouette',
		stroke: true,
		preserve: true,
		series: series_data
	});


	graph.render();

	//Add labels to the graph
	var abc=0
	var hoverDetail = new Rickshaw.Graph.HoverDetail( {
		graph: graph
	} );
	var maxy0 = 0;
	for(i=0;i<graph.series[include_artists.length-1].stack.length;i++){
		if(graph.series[include_artists.length-1].stack[i].y0 > maxy0){
			maxy0 = graph.series[include_artists.length-1].stack[i].y0;
		}
	}
	for(i=0;i<include_artists.length;i++){
		var ratio = 1500/maxy0;//3.21;
		artist_name = include_artists[i];
		x_point = userdata[artist_name][0][0];
		x_value_for_max_point = parseInt(x_point) - 1;
		//Let's calculate the y value
		first_line = (1500-parseInt(graph.series[i].stack[x_point-1].y0*ratio));
		if(i==include_artists.length-1){
			second_line = first_line-15;
		} else {
			second_line = (1500-parseInt(graph.series[i+1].stack[x_point-1].y0*ratio));
		}
		if(true || (first_line-second_line)>100){
			y_value_for_max_point = first_line - (first_line-second_line)/2;
		}
		//alert(artist_name + "-"+x_value_for_max_point+" && "+(((x_value_for_max_point)*3)+1));
		//y_value_for_max_point = parseInt(graph.series[i].path.getElementsByTagName("path")[0].getAttribute("d").split(',')[(((x_value_for_max_point)*3)+1)]);
		x_value_for_max_point *= 333;
		if(x_value_for_max_point<0) x_value_for_max_point=0;
		hoverDetail.currentX = x_value_for_max_point;
		hoverDetail.currentY = y_value_for_max_point;
		hoverDetail.currentH = (first_line-second_line);
		//console.log(artist_name+": "+x_point+"-- (x,y): ("+x_value_for_max_point+","+y_value_for_max_point+")");
		hoverDetail.update();
		artistnames.push(artist_name);
		
		//d3.select("#ex1").select("svg").append("text").text(artist_name).attr("x",x_value_for_max_point).attr("y",y_value_for_max_point);//.attr("fill","white");
		//document.getElementById("band_names").innerHTML += "<span id='"+selected_artist+"' style='position:absolute;top:"+y_value_for_max_point+";left:"+x_value_for_max_point+"'>"+artist_name+"</span>";
	}
	$('#left_box').css("display","none");
}