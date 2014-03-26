/*$.get( "http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user=Taurheim&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from=1394366400&to=1394971200", function( data ) {
  alert( "Data Loaded: " + data );
});*/



/****************************
 ***** CONFIG SHIT **********
 ****************************/
var graph_height = 1500;
var graph_width = 3000;
var showartistnames = true;
var normalize = false;
var font_color = "black";
var font_name = "Arial";
var graph_type = "Wiggle";
var time_start = 0;
var time_end = 0;
var min_playcount = 5;
var total_weeks = 0;

//Change this later
var old_start = 0;
var old_end = 0;

var userdata = {};
var full_week_data = [];

//Initialize datepickers, convert buttons
  
$(document).ready(function() {
	$("#save_as_svg").click(function() { submit_download_form("svg"); });
	$("#save_as_png").click(function() { pngconvert(); });
	$("#start_date").datepicker();
	$("#end_date").datepicker();
});
//TESTING
var test_artist = "---";


function CreateWave(){
	//Format the date
	rawdate = document.getElementById("start_date").value.split("/");
	time_start = new Date(rawdate[2],parseInt(rawdate[0])-1,rawdate[1],"0","0","0","0").getTime()/1000;
	time_start = round_week(time_start)-302400;
	
	rawdate = document.getElementById("end_date").value.split("/");
	time_end = new Date(rawdate[2],parseInt(rawdate[0])-1,rawdate[1],"0","0","0","0").getTime()/1000;
	time_end = round_week(time_end)-302400;
	
	if(time_end > round_week((new Date).getTime()/1000)){
		alert("Your end date is in the future");
		return false;
	}
	
	if(document.getElementById('user').value,document.getElementById('plays').value < 5){
		alert("Minimum number of plays to count is 5");
		return false;
	}
	
	graph_height = parseInt(document.getElementById("height").value);
	graph_width = parseInt(document.getElementById("width").value);
	font_name = document.getElementById("font_name").value;
	graph_type = document.getElementById("graph_type").value;
	showartistnames = document.getElementById("artist_names").checked;
	normalize = document.getElementById("normalize").checked;
	min_playcount = document.getElementById('plays').value;


	total_weeks = Math.ceil((time_end-time_start)/604800);
	if (total_weeks<4){
		alert("Please choose a time of at least 4 weeks");
		return false;
	}

	if(time_start == old_start && time_end == old_end){
		parseXML();
	} else {
		loadXML(document.getElementById('user').value);
	}



	old_start = time_start;
	old_end = time_end;

	//Hide settings box

	$('#box_1').css("display","none");
}

function loadXML(selected_user) {
	userdata = [];
	full_week_data = [];
	xmlhttp=new XMLHttpRequest();
	/*
	xmlhttp.open("GET","http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user="+selected_user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72",false);
	xmlhttp.send();
	userinfo = xmlhttp.responseXML;
	var time_start = round_week(userinfo.getElementsByTagName("registered")[0].getAttribute('unixtime'))-302400-604800;
	*/
	//Edited time start, last 10 weeks
	//time_start = round_week(time_start)-302400;
	
	//var time_end = time_start+604800;
	//var current_time = round_week(time_end);//round_week((new Date).getTime()/1000);//

	//User Data variable. Store all the information here, then graph it.

	//Calculate how many weeks the user has been on last.fm (we're going to run through the loop for every week)
	//New code - Asynchronous

	//Run through each week, adding a new call to the full_week_data
	for(w=1;w<=total_weeks;w++){
		get_week(selected_user,w);
	}
}

function parseXML(){

	//Run through every week, adding artists as we go
	$('#loading').html("Parsing XML...");

	for(w=1;w<=total_weeks;w++){
		week_data = full_week_data[w-1].responseXML;
		
		//If there is an error, add 0s to all artists
		if((week_data.getElementsByTagName("lfm")[0].getAttribute("status") != "ok") || week_data.getElementsByTagName("lfm")[0].childNodes.length<=1){
			console.log("Skipped Week "+w);
			for(artist in userdata){
				userdata[artist][w] = [w,0];
			}
			continue;
		}
		
		//Add an empty value for all artists (this will be overwritten if the artist doesn't get any plays in the current week)
		for (artist in userdata){
			userdata[artist][w] = [w,0];
		}
		
		//Get the number of artists with data this week
		artist_count = week_data.getElementsByTagName("artist").length;
		if(artist_count==0){
			continue; //Empty week
		}
		//Run through every artist, adding to "userdata" as we go
		for(i=0;i<artist_count;i++){
		
			//Get each artist name,playcount
			artist_name = week_data.getElementsByTagName("name")[i].childNodes[0].nodeValue;
			artist_plays = week_data.getElementsByTagName("playcount")[i].childNodes[0].nodeValue;
			if((userdata[artist_name]!=undefined) && parseInt(artist_plays)>=5 || (parseInt(artist_plays)>=min_playcount)){
				if(userdata[artist_name] == undefined){
					//Add an artist if the artist didn't previously exist, fill all previous values with 0s
					userdata[artist_name] = [];
					for(n=1;n<=w;n++){
						userdata[artist_name][n] = [n,0];
					}
				}
				
				//Add the data to userdata
				userdata[artist_name][w] = [w,parseInt(artist_plays)];
				//If it's not the first week or the last week AND the current # of plays is higher than the previous max, update max
				if(((userdata[artist_name][0] == undefined || artist_plays>userdata[artist_name][0][1])) || w==1){
					userdata[artist_name][0] = [w,parseInt(artist_plays)];
				}
			}
		}
	}
	/**/
	//Now that we've got all of our data, draw the wave
	$('#loading').html("Finished parsing XML...");
	drawLastWave();
}


//Retrieve a single week
function get_week(user, weeknum){
	setTimeout( function() { 
		//Add a week to timer
		var week_start=time_start+ (604800*(weeknum-1));
		var week_end=week_start + 604800;

		//Get the data
		full_week_data.push(
					$.get("http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user="+user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72&from="+week_start+"&to="+week_end)
		);

		if(weeknum==total_weeks){
				xmlwait();
		}

		$('#loading').html("Loading week "+weeknum+" of "+total_weeks+"...<br/>");

	}, 500*(weeknum-1));
	
}

function xmlwait() {

	$.when.apply(null,full_week_data).done(function() {
		$('#loading').append("All weeks loaded!");
		parseXML();
	})
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


function show_svg_code()
{
	// Get the d3js SVG element
	var tmp  = document.getElementById("ex1");
	var svg = tmp.getElementsByTagName("svg")[0];

	// Extract the data as SVG text string
	var svg_xml = (new XMLSerializer).serializeToString(svg);

	//Optional: prettify the XML with proper indentations
	svg_xml = vkbeautify.xml(svg_xml);


}


var graph; //This can be removed, just here so we can see it in the DOM
function drawLastWave() {

	$('#loading').html("Drawing Wave...");
	
	document.getElementById("ex1").innerHTML = "";
	
	//Palette is the scheme (selected in the dropdown). We use this to make the graph itself.
	var palette = new Rickshaw.Color.Palette( { scheme: scheme.value } );
	if(scheme.value=="spectrum2001") font_color = "white";
	
	//Make a list of artists.
	var include_artists = [];
	for(artist in userdata){
		include_artists.push(artist);
	}

	//ORDERING

	//Split "include_artists" in half, then sort each to push the higher maxes to the middle
	/**/
	if(normalize){
		var firsthalf = include_artists.slice(0, include_artists.length /2);
		var secondhalf = include_artists.slice(include_artists.length/2,include_artists.length);

		firsthalf.sort(function (a,b){
			return userdata[a][0][1]-userdata[b][0][1];
		});
		secondhalf.sort(function (a,b){
			return userdata[b][0][1]-userdata[a][0][1];
		});
		include_artists = firsthalf.concat(secondhalf);
	}
	/**/

	
	//This is how the actual graph is created.
	var series_data = [];
	
	//Which artist are we currently selecting(chosen in the next for loop)
	var selected_artist;

	
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
		
	//OFFSETS:
	
	//silhouette - center the stream, as in ThemeRiver.
	//wiggle - minimize weighted change in slope.
	//expand - normalize layers to fill the range [0,1].
	//zero - use a zero baseline, i.e., the y-axis.
	graph = new Rickshaw.Graph( {
		element: document.querySelector("#ex1"), 
		width: graph_width, 
		height: graph_height, 
		renderer: 'area',
		offset: graph_type,
		stroke: true,
		preserve: true,
		series: series_data
	});


	graph.render();
	if(showartistnames){
	/*
		//Add labels to the graph.
		var hoverDetail = new Rickshaw.Graph.HoverDetail( {
			graph: graph
		} );*/
		var maxy0 = 0;
		for(i=0;i<graph.series[include_artists.length-1].stack.length;i++){
			if((graph.series[include_artists.length-1].stack[i].y0+graph.series[include_artists.length-1].stack[i].y) > maxy0){
				maxy0 = graph.series[include_artists.length-1].stack[i].y0+graph.series[include_artists.length-1].stack[i].y;
			}
		}
		
		//Get ratios
		var yratio = graph.height/maxy0;
		var xratio = graph.width/(graph.series[0].stack.length-1);
		console.log("y ratio: "+yratio);
		/*for(i=0;i<include_artists.length;i++){
			artist_name = include_artists[i];
			x_point = userdata[artist_name][0][0];
			topleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y + graph.series[i].stack[x_point-2].y0)*yratio};
			btmleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y0)*yratio};
			
			if(graph.series[i].data.length != x_point){
			topright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y + graph.series[i].stack[x_point].y0)*yratio};
			btmright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y0)*yratio};
			} else {
			topright = {"x": (x_point-1)*xratio + 1, "y": (graph.series[i].stack[x_point-1].y + graph.series[i].stack[x_point-1].y0/2)*yratio};
			btmright = {"x": (x_point-1)*xratio + 1, "y": (graph.series[i].stack[x_point-1].y + graph.series[i].stack[x_point-1].y0/2)*yratio};
			}
			// alert(topright);
		}*/
		for(i=0;i<include_artists.length;i++){
			var fontsize = 100; //default
			artist_name = include_artists[i];
			x_point = userdata[artist_name][0][0];
			x_value_for_max_point = parseInt(x_point) - 1;
			
			// >>>> NEW
			
			// Find y value
			bottom_point = parseInt(graph.series[i].stack[x_point-1].y0);
			offset = parseInt(graph.series[i].stack[x_point-1].y/2);
			middle_point = bottom_point + offset;
			
			//Scale
			x_value_for_max_point *= xratio;
			y_value_for_max_point = graph.height - middle_point*yratio + 5;
			
			//Move slightly to center the text box
			x_value_for_max_point -= (artist_name.length*5)/2;
			
			if(x_value_for_max_point<0) x_value_for_max_point=0;
			/*hoverDetail.currentX = x_value_for_max_point;
			hoverDetail.currentY = y_value_for_max_point;
			hoverDetail.currentH = offset*ratio;
			console.log(artist_name+": "+x_point+"-- (x,y): ("+x_value_for_max_point+","+y_value_for_max_point+")");
			hoverDetail.update();*/
			
			/* EPIC SHIT ABOUT TO GO DOWN */
			
			/* THIS IS BEING TESTED WITH Zonrup: Metric */
			//if(artist_name == "Metric"){
			// Alright, let's try to size the text based on how much space we have.
			
			//First, let's get some terminology down.
			//
			//     \     /
			//    A \ a / B
			//        o
			//       			A,B,C,D are equations of lines
			//					a,b are the upper and lower points
			//					all calculations will be done in pixels, so we need to convert it all using our ratios.
			//					all calculations also done with bottom being down (at the end we need to convert graph.height-y values)
			//        o
			//    C / b  \ D
			//    /       \
			//
			
			//Get a,b
			a = {"x": (x_point-1)*xratio, "y": (graph.series[i].stack[x_point-1].y + graph.series[i].stack[x_point-1].y0)*yratio};
			b = {"x": (x_point-1)*xratio, "y": (graph.series[i].stack[x_point-1].y0)*yratio};
			
			//If our height isn't big enough to fit a font, gtfo.
			if(artist_name.height("8px "+font_name) > a.y-b.y){
				continue;
			}
			//console.log(artist_name + " - "+a.y +","+ b.y);
			
			//To get A,B,C,D we need the surrounding 4 points (hereafter referred to as topleft,topright,btmleft,btmright
			
			//If we're on the edge, add the left/right points accordingly
			if(x_point-2<0){
				topleft = {"x": (x_point-1)*xratio -1, "y": b.y+((a.y-b.y)/2)};
				btmleft = {"x": (x_point-1)*xratio -1, "y": b.y+((a.y-b.y)/2)};
			} else {
				topleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y + graph.series[i].stack[x_point-2].y0)*yratio};
				btmleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y0)*yratio};
			}
			
			if((x_point)==total_weeks){
				topright = {"x": ((x_point-1)*xratio)+5, "y": (b.y)+((a.y-b.y)/2)};
				btmright = {"x": ((x_point-1)*xratio)+5, "y": (b.y)+((a.y-b.y)/2)};
			} else {
				topright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y + graph.series[i].stack[x_point].y0)*yratio};
				btmright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y0)*yratio};
			}
			
			
			if(artist_name==test_artist){
				d3.select("#ex1").select("svg").append("line").attr("x1",topleft.x).attr("y1",graph.height-topleft.y).attr("x2",a.x).attr("y2",graph.height-a.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#ex1").select("svg").append("line").attr("x1",btmleft.x).attr("y1",graph.height-btmleft.y).attr("x2",b.x).attr("y2",graph.height-b.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#ex1").select("svg").append("line").attr("x1",a.x).attr("y1",graph.height-a.y).attr("x2",topright.x).attr("y2",graph.height-topright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
				d3.select("#ex1").select("svg").append("line").attr("x1",b.x).attr("y1",graph.height-b.y).attr("x2",btmright.x).attr("y2",graph.height-btmright.y).attr("style","stroke:rgb(255,0,0);stroke-width:2");
			}
			
			//Now we can find the slopes for ABCD, mA,mB,mC,mD
			mA = (a.y - topleft.y)/(a.x - topleft.x);
			mB = (topright.y - a.y)/(topright.x - a.x);
			mC = (b.y - btmleft.y)/(b.x - btmleft.x);
			mD = (btmright.y - b.y)/(btmright.x - b.x);
			
			/*console.log(artist_name);
			if(mA>0 && mB>0) console.log("//");
			if(mA<0 && mB>0) console.log("\\/");
			if(mA<0 && mB<0) console.log("\\\\");
			if(mA>0 && mB<0) console.log("/\\");
			
			if(artist_name == "Justice"){
				console.log(a);
				console.log(b);
				console.log(topleft);
				console.log(topright);
				console.log(btmleft);
				console.log(btmright);
			}/**/
			
			//And the y intercepts
			bA = a.y - mA*a.x;
			bB = a.y - mB*a.x;
			bC = b.y - mC*b.x;
			bD = b.y - mD*b.x;
			
			//(to 10 decimal places)
			mA = parseInt(mA*10000000000)/10000000000;
			mB = parseInt(mB*10000000000)/10000000000;
			mC = parseInt(mC*10000000000)/10000000000;
			mD = parseInt(mD*10000000000)/10000000000;
			
			
			//Let's figure out the dimensions of our box. For Arial, the average character width is 2/3 of the pixel height
			// e.g. If our font size is 20px and the name is 5 characters long (e.g. Metric), then the box size would be 20*(2/3)*5 = 67px
			boxRatio = parseInt(artist_name.length*(2.2/3))
			
			
			//There are 16 different possible combinations of line slopes. 7 are eliminated (they never happen), which leaves 9 left.
			
			/* Here are the leftover options
				\/	/\	\\	//	/\	/\	\\	//	/\
				\/	/\	\\	//	//	\\	\/	\/	\/
				w1	w2	x1	x2	y1	y2	y3	y4	z1
			*/
			
			// TYPE: w
			// DESCRIPTION: One set facing inwards, one set facing outwards
			// APPROACH: Assume that the text box's side must touch one of the points, and is then bounded by the left and right by the inward facing lines
			//				w2									w1
			if(((mA<=0)&&(mB>=0)&&(mC<0)&&(mD>0))||((mA>0)&&(mB<0)&&(mC>=0)&&(mD<=0))){
				if(artist_name==test_artist){
					console.log(artist_name + " - w" + " - " + mA + "," + mB + "," + mC + "," + mD);
				}
				fontsize = 5;
				if(mA>0){ // w2
					//console.log("\/\\"+artist_name);
					btm_bound = b.y;
					while(true){
						//Find the bottom bound of our textbox
						btm_bound = b.y + fontsize;
						coll_left = (btm_bound - bA)/mA;
						if(coll_left<topleft.x) coll_left=topleft.x;
						coll_right = (btm_bound - bB)/mB;
						if(coll_right>topright.x) coll_right=topright.x;
						boxWidth = artist_name.width(fontsize+"px "+font_name);
						if((coll_right-coll_left)>(topright.x-topleft.x)){
							coll_left = topleft.x;
							fontsize = topleft.y - coll_left.y;
							break;
						} else if((coll_right-coll_left)>boxWidth){
							fontsize+=2;
						} else {
							break;
						}
					}
					if(artist_name.height(fontsize+"px "+font_name)>a.y-b.y){
						//TODO
						//Change this so that it will keep subtracting font sizes until it fits
						fontsize = a.y-b.y;
					}
					fontsize*=0.75;
					y_value_for_max_point = graph.height - btm_bound + artist_name.height(fontsize+"px "+font_name)/2;
				} else { //w1
					//console.log("\\\/"+artist_name);
					top_bound = a.y;
					while(true){
						//Find the bottom bound of our textbox
						btm_bound = a.y - fontsize;
						coll_left = (btm_bound - bC)/mC;
						if(coll_left<topleft.x) coll_left=topleft.x;
						coll_right = (btm_bound - bD)/mD;
						if(coll_right>topright.x) coll_right=topright.x;
						boxWidth = artist_name.width(fontsize+"px "+font_name);
						if((coll_right-coll_left)>(topright.x-topleft.x)){
							coll_left = topleft.x;
							fontsize = top_bound - btmleft.y;
							break;
						} else if((coll_right-coll_left)>(boxWidth)){
							fontsize+=2;
						} else {
							break;
						}
					}
				//CHANGE THIS (see above)
				if(artist_name.height(fontsize+"px "+font_name)>a.y-b.y){
					fontsize = a.y-b.y;
				}
				fontsize*=0.9;
				y_value_for_max_point = graph.height - top_bound + artist_name.height(fontsize+"px "+font_name);
				}
				boxWidth = artist_name.width(fontsize+"px "+font_name);
				x_value_for_max_point = coll_left;//+boxWidth*0.15;
				/*if(fontsize==5){
					console.log("Skipping "+artist_name);
					continue;
				}*/
				//Extra positioning to make up for curves
				if(mC<0.5 && mC>0 && mD<-1.5){
					y_value_for_max_point -= artist_name.height(fontsize+"px "+font_name)/2;
					console.log("[w]Correcting "+artist_name);
				}
			}
			
			
			// TYPE: x
			// DESCRIPTION: Two straight lines (top & bottom both have one inward facing, one outward facing)
			// APPROACH: Find the max width line, assume that the box is centered around it, keep resizing the box until it fits
			else if(((mA<=0)&&(mB<0)&&(mC<0)&&(mD<=0))||((mA>0)&&(mB>=0)&&(mC>=0)&&(mD>0))){
				
			if(artist_name==test_artist){
				console.log(artist_name + " - x" + " - " + mA + "," + mB + "," + mC + "," + mD);
			}
				//Run through all y values, check width.
				//maxWidth = [actual width, y value, left_coll]
				maxWidth = [0,0];
				for (v=(b.y+1);v<a.y;v++){
					if(mA>=0){
						coll_left = (v-bA)/mA;
						coll_right = (v-bD)/mD;
					} else {
						coll_left = (v-bC)/mC;
						coll_right = (v-bB)/mB;
					}
					//If either of our collisions are outside of the bounds, then (FOR NOW) we will just cut it off there, but later we could add it so that it looks at the surrounding area to maximize the font further.
					if(coll_left<topleft.x) coll_left = topleft.x;
					if(coll_right>topright.x) coll_right = topright.x;
					pointWidth = coll_right-coll_left;
					if(pointWidth > maxWidth[0]){
						maxWidth[0] = pointWidth;
						maxWidth[1] = v;
						maxWidth[2] = coll_left;
					}
				
				}
				
				//Find out the slope of the box from the topleft corner to the bottomleft corner (height/width)
				//From now on, this diagonal is referred to as "diag"
				ctrpt = {"x": maxWidth[2] + maxWidth[0]/2, "y": maxWidth[1]};
				mDiag = artist_name.slope();
				if(mA>0) mDiag*=-1;
				bDiag = ctrpt.y - mDiag*ctrpt.x;
				
				//Now find the points of intersection of diag with all of the other lines x = b2 - b1/m1 - m2
				//A
				diag_A = {"x" : (bDiag-bA)/(mA - mDiag), "y" : mDiag*((bDiag-bA)/(mA - mDiag)) + bDiag};
				//B
				diag_B = {"x" : (bDiag-bB)/(mB - mDiag), "y" : mDiag*((bDiag-bB)/(mB - mDiag)) + bDiag};
				//C
				diag_C = {"x" : (bDiag-bC)/(mC - mDiag), "y" : mDiag*((bDiag-bC)/(mC - mDiag)) + bDiag};
				//D
				diag_D = {"x" : (bDiag-bD)/(mD - mDiag), "y" : mDiag*((bDiag-bD)/(mD - mDiag)) + bDiag};
				
				//Now we have a bunch of intersection points, but don't know which one is the "real" border, so we're going to find a top and bottom collision
				//Top collision
				
				//Ignore intersections if:
				// A collision is right of the center
				// B collision is left of the center
				// C collision is right of the center
				// D collision is left of the center
				if(diag_A.x > a.x) {var top_collision = diag_B}
				if(diag_B.x < a.x) {var top_collision = diag_A}
				if(diag_C.x > a.x) {var btm_collision = diag_D}
				if(diag_D.x < a.x) {var btm_collision = diag_C}
				//if(artist_name=="Daft Punk") var btm_collision = diag_C;
				
				/*if(diag_A.y < diag_B.y) {top_collision = diag_A;} else {top_collision = diag_B;}
				if(diag_C.y > diag_D.y) {btm_collision = diag_C;} else {btm_collision = diag_D;}*/
				if(typeof top_collision === 'undefined'){
					console.log("Error labelling "+artist_name);
					continue;
				}
				fontsize = Math.abs(parseInt((top_collision.x-btm_collision.x)*artist_name.slope()));
				if(fontsize>a.y-b.y){
					fontsize = Math.abs(a.y-b.y);
				}
				
				fontsize*=0.9;
				boxHeight = artist_name.height(fontsize+"px "+font_name);
				boxWidth = artist_name.width(fontsize+"px "+font_name);
				
				//Which x/y values we pick is based on whether we have the graph getting steeper/shallower after a&b

				//Steeper
				if(mA<0 && mB<mA && mD<mC){
					console.log("trigger "+ artist_name)
					x_value_for_max_point = Math.max(top_collision.x,btm_collision.x) - boxWidth;
					y_value_for_max_point = graph.height - top_collision.y + boxHeight*0.3;
				} else {
					x_value_for_max_point = Math.min(top_collision.x,btm_collision.x);//ctrpt.x - boxWidth/2;
					y_value_for_max_point = graph.height-btm_collision.y;//graph.height - maxWidth[1] + boxHeight/2;
				}
				//There's no way I can make an estimate for this
				if((Math.abs(mA+mC)<0.25 && Math.abs(mB+mD)>2) || (Math.abs(mB+mD)<0.25 && Math.abs(mA+mC)>2) ){
					console.log("Impossible to estimate "+artist_name);
				}
				if(artist_name==test_artist){
					console.log(coll_right)
					console.log(maxWidth);
					//Green line
					d3.select("#ex1").select("svg").append("line").attr("x1",maxWidth[2]).attr("y1",graph.height-maxWidth[1]).attr("x2",maxWidth[2]+maxWidth[0]).attr("y2",graph.height-maxWidth[1]).attr("style","stroke:rgb(0,255,0);stroke-width:1");
					d3.select("#ex1").select("svg").append("circle").attr("cx",top_collision.x).attr("cy",graph.height - top_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
					d3.select("#ex1").select("svg").append("circle").attr("cx",btm_collision.x).attr("cy",graph.height - btm_collision.y).attr("r",3).attr("stroke-width",5).attr("fill","black");
					d3.select("#ex1").select("svg").append("circle").attr("cx",ctrpt.x).attr("cy",graph.height - ctrpt.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
				
				}
			}
			// TYPE: y
			// DESCRIPTION: One straight line, two lines facing inward
			// APPROACH: Assume that the corner of the largest box must touch the inward facing side of the "straight line", then do a recursive function.
			// 1. Find out which line is the "straight" line (one facing in, one facing out)
			// 2. Start at the point on that line (a or b), draw a diagonal away from it (opposite sign slope) with a slope equal to the ratio between height and width for our text box
			// 3. This line will hit the opposite line at some x value. Pretend that the diagonal that we just drew was one of the diagonals of our textbox. 
			//     Draw another diagonal with opposite slope to our original diagonal, starting at the top corner of our pretend textbox. Continue this diagonal until it hits the opposite line
			// 4. Go straight up from the point of contact of the diagonal and line
			// 5. From this new point, run steps 2-4 until the x point is similar each run.
			//			y1									y2								y3							y4
			else if((mA>0)&&(mB<0)&&(mC>=0)&&(mD>0)||(mA>0)&&(mB<0)&&(mC<0)&&(mD<=0)||(mA<=0)&&(mB<0)&&(mC<0)&&(mD>0)||(mA>0)&&(mB>=0)&&(mC<0)&&(mD>0)){
				
				if(artist_name==test_artist){
					console.log(artist_name + " - y" + " - " + mA + "," + mB + "," + mC + "," + mD);
				}
				//Let's get our starting point, and figure out the sign of our first line.
				var start_point; //a or b
				var offset_sign; //In step 3, we need to offset. If our start point is a, we offset downwards (-1), if it is b, we offset upwards (1)
				var slope_sign; //1 or -1
				var slope = artist_name.slope(); //slope of initial line
				var mO; //This is the opposite side line
				var bO;
				var mV; //This line is horizontally opposite to O
				var bV;
				var mU; //This line is vertically opposite to V
				//var bU;
				var offset = 0; //This variable is helpful to move the text to give room for curved edges (we pretend like we're only dealing with flat in all the calculations)
				if(mA<=0 && mB<0 || mA>=0 && mB>=0) {
					start_point = a;
					offset_sign = -1;
					if(mA>0 || mA==0 && mB>0){ //Opposite line: D -> C ^ A
						//console.log("a");
						slope_sign = -1;
						mO = mD;
						bO = bD;
						mV = mC;
						bV = bC;
						mU = mA;
						bU = bA;
					}
					if(mA<0 || mA==0 && mB<0){ //Opposite line: C -> D ^ B
						//console.log("b");
						slope_sign = 1;
						mO = mC;
						bO = bC;
						mV = mD;
						bV = bD;
						mU = mB;
						bU = bB;
					}
				} else if(mC<=0 && mD<0 || mC>=0 && mD>0) {
					start_point = b;
					offset_sign = 1;
					if(mC>=0){ //Opposite line: A -> B ^ D
						//console.log("c");
						slope_sign = -1;
						mO = mA;
						bO = bA;
						mV = mB;
						bV = bB;
						mU = mD;
						bU = bD;
						if(mC<0.2 && mD>1){
							offset=1;
						}
					}
					if(mC<0){ //Opposite line: B -> A ^ C
						//console.log("d");
						slope_sign = 1;
						mO = mB;
						bO = bB;
						mV = mA;
						bV = bA;
						mU = mC;
						bU = bC;
						if(mC>-0.2 && mD<-1){
							offset=1;
						}
					}
				} else {
					console.log("Really weird error - "+artist_name);
					console.log(artist_name + " - y" + " - " + mA + "," + mB + "," + mC + "," + mD);
				}
				
				//Draw the line (from now on referred to as Q)
				/*RECURSIVE PART*/
				//while(true) {
				//if(artist_name == "Said The Whale"){
				
				
				var count=0;
				last_last_last_fontsize = 0;
				last_last_fontsize = 0;
				last_fontsize = 0;
				previous_start_point = {"x":0,"y":0};
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
						(((mA>0)&&(mB<0)&&(mC>=0)&&(mD>0)) && ((bV-bQ)/(mQ-mV) < topright.x) && (bV-bQ)/(mQ-mV) > a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV > topright.y)
						||
						//y2
						(((mA>0)&&(mB<0)&&(mC<0)&&(mD<=0)) && ((bV-bQ)/(mQ-mV) > topleft.x) && (bV-bQ)/(mQ-mV) < a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV > topleft.y)
						||
						//y3
						(((mA<=0)&&(mB<0)&&(mC<0)&&(mD>0)) && ((bV-bQ)/(mQ-mV) < topright.x) && (bV-bQ)/(mQ-mV) > a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV < btmright.y)
						||
						//y4
						(((mA>0)&&(mB>=0)&&(mC<0)&&(mD>0)) && ((bV-bQ)/(mQ-mV) > topleft.x) && (bV-bQ)/(mQ-mV) < a.x && ((mV)*(bV-bQ)/(mQ-mV))+bV < btmleft.y)
					 ) {
						start_point = previous_start_point;
						break;
					 } else {
					
						//Find intersection between Q and O
						//Intersection: x = (b2-b1)/(m1-m2). line 1 = Q, line 2 = O
						intersect1 = {"x": (bO - bQ)/(mQ - mO), "y": ((mO)*(bO - bQ)/(mQ - mO))+bO};
					}
					
					
					//New line going backwards (from now on referred to as X)
					mX = slope*slope_sign*-1;
					bX = start_point.y - mX*intersect1.x;
					
					//Find intersection between X and V
					
					//First check if X collides with line U before it collides with V
					if(
						//y1
						(((mA>0)&&(mB<0)&&(mC>=0)&&(mD>0)) && ((bU-bX)/(mX-mU) < topright.x) && (bU-bX)/(mX-mU) > a.x && ((mU)*(bU-bX)/(mX-mU))+bU < topright.y)
						||
						//y2
						(((mA>0)&&(mB<0)&&(mC<0)&&(mD<=0)) && ((bU-bX)/(mX-mU) > topleft.x) && (bU-bX)/(mX-mU) < a.x && ((mU)*(bU-bX)/(mX-mU))+bU < topleft.y)
						||
						//y3
						(((mA<=0)&&(mB<0)&&(mC<0)&&(mD>0)) && ((bU-bX)/(mX-mU) < topright.x) && (bU-bX)/(mX-mU) > a.x && ((mU)*(bU-bX)/(mX-mU))+bU > btmright.y)
						||
						//y4
						(((mA>0)&&(mB>=0)&&(mC<0)&&(mD>0)) && ((bU-bX)/(mX-mU) > topleft.x) && (bU-bX)/(mX-mU) < a.x && ((mU)*(bU-bX)/(mX-mU))+bU > btmleft.y)
					 ) {
						intersect2 = { "x": (bU - bX)/(mX - mU), "y": ((mU)*(bU - bX)/(mX - mU))+bU};
					 } else {
					
					//Intersection x = (b2-b1)/(m1-m2). line 1 = X, line 2 = V
					intersect2 = {"x": (bV - bX)/(mX - mV), "y": ((mV)*(bV - bX)/(mX - mV))+bV};
					}
					if(artist_name==test_artist){
						//green line (start_point -> intersect1)
						d3.select("#ex1").select("svg").append("line").attr("x1",start_point.x).attr("y1",graph.height-start_point.y).attr("x2",intersect1.x).attr("y2",graph.height-intersect1.y).attr("style","stroke:rgb(0,255,0);stroke-width:1");
						//blue line  (intersect1 -> intersect2) (X)
						d3.select("#ex1").select("svg").append("line").attr("x1",intersect1.x).attr("y1",graph.height-start_point.y).attr("x2",intersect2.x).attr("y2",graph.height-intersect2.y).attr("style","stroke:rgb(0,0,255);stroke-width:1");
						
						//intersect2
						d3.select("#ex1").select("svg").append("circle").attr("cx",intersect2.x).attr("cy",graph.height-intersect2.y).attr("r",3).attr("stroke-width",5).attr("fill","red");
					}
					
					//Check if we're out of our bounds
					if(intersect2.x < topleft.x || intersect2.x > topright.x){
						intersect2.x = (intersect2.y - bU)/mU;
					}
					
					previous_start_point = start_point;
					if(intersect2.x<topleft.x){
						intersect2.x= topleft.x;
					}
					if(intersect2.x>topright.x){
						intersect2.x = topright.x;
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
				
				//Pick value based on type
									 
				//y1
				if((mA>0)&&(mB<0)&&(mC>=0)&&(mD>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph.height - start_point.y;}
				//y2
				if((mA>0)&&(mB<0)&&(mC<0)&&(mD<=0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph.height - previous_start_point.y;}
				//y3
				if((mA<=0)&&(mB<0)&&(mC<0)&&(mD>0)){x_value_for_max_point = intersect1.x;y_value_for_max_point = graph.height - intersect1.y;}
				//y4
				if((mA>0)&&(mB>=0)&&(mC<0)&&(mD>0)){x_value_for_max_point = previous_start_point.x;y_value_for_max_point = graph.height - intersect1.y;}
				//x_value_for_max_point = Math.min(start_point.x,intersect1.x,intersect2.x);
				
				//y_value_for_max_point = graph.height - Math.min(start_point.y,intersect1.y,intersect2.y);// - Math.abs((  intersect2.y - start_point.y - artist_name.height(fontsize+"px "+font_name) )/2);// - fontsize*offset;
				
				if(artist_name==test_artist){
						//black line (start_point -> intersect1)
						d3.select("#ex1").select("svg").append("line").attr("x1",start_point.x).attr("y1",graph.height-start_point.y).attr("x2",intersect1.x).attr("y2",graph.height-intersect1.y).attr("style","stroke:rgb(0,0,0);stroke-width:1");
						//white line  (intersect1 -> intersect2)
						d3.select("#ex1").select("svg").append("line").attr("x1",intersect1.x).attr("y1",graph.height-start_point.y).attr("x2",intersect2.x).attr("y2",graph.height-intersect2.y).attr("style","stroke:rgb(255,255,255);stroke-width:1");
						//black dot - final resting point
						d3.select("#ex1").select("svg").append("circle").attr("cx",x_value_for_max_point).attr("cy",y_value_for_max_point).attr("r",3).attr("stroke-width",5).attr("fill","black");
				}
				//Curve fixes

				//if C is flat and D is steep
				if(mC>-0.5 && mC<0.5 && mD<-1 && (y_value_for_max_point<(b.y-Math.abs(b.y-a.y)))){
					//x_value_for_max_point += "W".width(fontsize+"px "+font_name);
					y_value_for_max_point -= (.5*artist_name.height(fontsize+"px "+font_name));
					//if(artist_name ==test_artist){
						console.log("[y]Correcting " + artist_name);
					//}
				}
				//}
				//fontsize = 25;
				
			}
			
			
			// TYPE: z
			// DESCRIPTION: Enclosed area
			// APPROACH: Find the midpoint between topright and btmright, and the midpoint of topleft and btmleft, then draw a line between the two midpoints
			// 			and find the midpoint of THAT line. Then keep the text centered on this point and expand it until it's sized properly.
			// MP formula: (x+x)/2 , (y+y)/2
			else if((mA>0)&&(mB<0)&&(mC<0)&&(mD>0)){

				if(artist_name==test_artist){
					console.log(artist_name + " - z" + " - " + mA + "," + mB + "," + mC + "," + mD);
				}
				//Get all the midpoints
				rightMP = {"x": (topright.x+btmright.x)/2, "y" : (topright.y+btmright.y)/2};
				leftMP = {"x": (topleft.x+btmleft.x)/2, "y" : (topleft.y+btmleft.y)/2};
				middleMP = {"x": (leftMP.x+rightMP.x)/2, "y" : (leftMP.y+rightMP.y)/2};
				

				
				//Base font size
				fontsize = 6;
				while(true){
					//Moving out from the center point, increase the font size and check for collisions
					boxHeight = fontsize;
					boxWidth = artist_name.width(fontsize+"px "+font_name);
						
					//Get a y value for the top and bottom of the constraint box
					boxTop = middleMP.y + boxHeight/2;
					boxBottom = middleMP.y - boxHeight/2;
					//Check left and right collisions, distance between them
					//Top
					coll_A = (boxTop-bA)/mA;
					coll_C = (boxTop-bC)/mC;
					coll_topleft = Math.max(coll_A,coll_C);
					if(coll_topleft<topleft.x) coll_topleft = topleft.x;
					
					coll_B = (boxTop-bB)/mB;
					coll_D = (boxTop-bD)/mD;
					coll_topright = Math.min(coll_B,coll_D);
					if(coll_topright>topright.x) coll_topright = topright.x;
					
					boxTopWidth = coll_topright-coll_topleft;
					
					//Bottom
					coll_A = (boxBottom-bA)/mA;
					coll_C = (boxBottom-bC)/mC;
					coll_btmleft = Math.max(coll_A,coll_C);
					if(coll_btmleft<topleft.x) coll_btmleft = topleft.x;
					
					coll_B = (boxBottom-bB)/mB;
					coll_D = (boxBottom-bD)/mD;
					coll_btmright = Math.min(coll_B,coll_D);
					if(coll_btmright>topright.x) coll_btmright = topright.x;
					
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
				y_value_for_max_point = graph.height - middleMP.y + boxHeight/2;
			}
			
			else {
				console.log(artist_name + " - ERROR" + " - " + mA + "," + mB + "," + mC + "," + mD);
			}
			
			
			//Find width (start at b and work upwards)
			//This might not be helpful but I'll leave it here for now.

			
			//From testing, arial height:width ratio is about 3:2
			//fontsize=40;
			//So, the equation for each line will be something like this: y = mA (x) + b
			if(fontsize<8){
				//console.log(artist_name +" failed with a font size of "+fontsize);
				continue;
			}
			d3.select("#ex1").select("svg").append("text").text(artist_name).attr("x",x_value_for_max_point).attr("y",y_value_for_max_point).attr("font-size",fontsize).attr("fill",font_color).attr("font-family",font_name);
			//document.getElementById("band_names").innerHTML += "<span id='"+selected_artist+"' style='position:absolute;top:"+y_value_for_max_point+";left:"+x_value_for_max_point+"'>"+artist_name+"</span>";
		}
	}
	$('#loading').html("Wave Complete!");
	$('#box_2').css("display","block");
	addWatermark();
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
  var f = font || '24px arial',
      o = $('<div>' + this + '</div>')
            .css({'position': 'absolute', 'float': 'left', 'white-space': 'nowrap', 'visibility': 'hidden', 'font': f})
            .appendTo($('body')),
      w = o.width();

  o.remove();

  return 24/w;
}

function pngconvert(){
    var $container = $('#ex1'),
        // Canvg requires trimmed content
        content = $container.html().trim(),
        canvas = document.getElementById('svg-canvas');

    // Draw svg on canvas
    canvg(canvas, content);
	$('svg-canvas').empty();
    // Change img be SVG representation
    var theImage = canvas.toDataURL('image/png');
	$('#ex1').html('<img id="svg-img" />');
    $('#svg-img').attr('src', theImage);
	$('#box_1').css("display","none");
	
}

function show_options(){

	$('#box_1').css("display","block");
	$('#box_2').css("display","none");
	graph = "";
	include_artists = "";
}

function addWatermark(){
	var watermark = "savas.ca/lastwave";
	var watermark_height = graph.height*0.03;
	var watermark_width = watermark.width(watermark_height+"px Lucida Sans Unicode");

	d3.select("#ex1").select("svg").append("text").text(watermark).attr("x",graph.width-watermark_width).attr("y",graph.height).attr("font-size",watermark_height).attr("fill","#000").attr("font-family","Lucida Sans Unicode, Lucida Grande, sans-serif").transition().style("opacity", 0.5);

}