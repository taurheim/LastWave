/****************************
 ***** CONFIG SHIT **********
 ****************************/
var graph_height = 1500;
var graph_width = 3000;
var showartistnames = true;



function CreateWave(){
	graph_height = parseInt(document.getElementById("height").value);
	graph_width = parseInt(document.getElementById("width").value);
	showartistnames = document.getElementById("artist_names").checked;
	loadXML(document.getElementById('user').value,document.getElementById('plays').value);
}
var userdata = {};
function loadXML(selected_user,min_playcount) {
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
			if((userdata[artist_name]!=undefined) || (parseInt(artist_plays)>=min_playcount)){
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
				if(w!=1 && (userdata[artist_name][0] == undefined || artist_plays>userdata[artist_name][0][1])){
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


}


$(document).ready(function() {
	create_d3js_drawing();

	// on first visit, randomize the positions & colors

	// Attached actions to the buttons

	$("#save_as_svg").click(function() { submit_download_form("svg"); });

	$("#save_as_pdf").click(function() { submit_download_form("pdf"); });

	$("#save_as_png").click(function() { submit_download_form("png"); });
});
var graph; //This can be removed, just here so we can see it in the DOM
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
		width: graph_width, 
		height: graph_height, 
		renderer: 'area',
		offset: 'silhouette',
		stroke: true,
		preserve: true,
		series: series_data
	});


	graph.render();
	if(showartistnames){
		//Add labels to the graph.
		var hoverDetail = new Rickshaw.Graph.HoverDetail( {
			graph: graph
		} );
		var maxy0 = 0;
		for(i=0;i<graph.series[include_artists.length-1].stack.length;i++){
			if(graph.series[include_artists.length-1].stack[i].y0 > maxy0){
				maxy0 = graph.series[include_artists.length-1].stack[i].y0;
			}
		}
		
		//Get ratios
		var yratio = graph.height/maxy0;
		var xratio = graph.width/(graph.series[0].stack.length-1);
		console.log("ratio: "+yratio);
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
			artistnames.push(artist_name);
			
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
			
			//To get A,B,C,D we need the surrounding 4 points (hereafter referred to as topleft,topright,btmleft,btmright
			
			topleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y + graph.series[i].stack[x_point-2].y0)*yratio};
			btmleft = {"x": (x_point-2)*xratio, "y": (graph.series[i].stack[x_point-2].y0)*yratio};
			
			if(graph.series[i].data.length != x_point){
			topright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y + graph.series[i].stack[x_point].y0)*yratio};
			btmright = {"x": (x_point)*xratio, "y": (graph.series[i].stack[x_point].y0)*yratio};
			} else {
			topright = {"x": (x_point-1)*xratio + 1, "y": (graph.series[i].stack[x_point-1].y + graph.series[i].stack[x_point-1].y0/2)*yratio};
			btmright = {"x": (x_point-1)*xratio + 1, "y": (graph.series[i].stack[x_point-1].y + graph.series[i].stack[x_point-1].y0/2)*yratio};
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
				//console.log(artist_name + " - w" + " - " + mA + "," + mB + "," + mC + "," + mD);
				fontsize = 5;
				if(mA>0){ // w2
					//console.log("\/\\"+artist_name);
					btm_bound = b.y;
					while(true){
						//Find the bottom bound of our textbox
						btm_bound = b.y + fontsize;
						coll_left = (btm_bound - bA)/mA;
						coll_right = (btm_bound - bB)/mB;
						boxWidth = fontsize*boxRatio;
						
						if((coll_right-coll_left)>boxWidth){
							fontsize+=2;
						} else {
							break;
						}
					if(fontsize>a.y-b.y){
						fontsize = a.y-b.y;
					}
					y_value_for_max_point = graph.height - btm_bound + fontsize/2;
					}
				} else { //w1
					//console.log("\\\/"+artist_name);
					top_bound = a.y;
					while(true){
						//Find the top bound of our textbox
						btm_bound = a.y - fontsize;
						coll_left = (top_bound - bC)/mC;
						coll_right = (top_bound - bD)/mD;
						boxWidth = fontsize*boxRatio;
						if((coll_right-coll_left)>(boxWidth)){
							fontsize+=2;
						} else {
							break;
						}
					}
				if(fontsize>a.y-b.y){
					fontsize = a.y-b.y;
				}
				y_value_for_max_point = graph.height - top_bound + fontsize;
				}
				
				boxWidth = fontsize*boxRatio;
				x_value_for_max_point = coll_left;
				/*if(fontsize==5){
					console.log("Skipping "+artist_name);
					continue;
				}*/
			}
			
			
			// TYPE: x
			// DESCRIPTION: Two straight lines (top & bottom both have one inward facing, one outward facing)
			// APPROACH: Find the max width line, assume that the box is centered around it, keep resizing the box until it fits
			else if(((mA<=0)&&(mB<0)&&(mC<0)&&(mD<=0))||((mA>0)&&(mB>=0)&&(mC>=0)&&(mD>0))){
				//console.log(artist_name + " - x" + " - " + mA + "," + mB + "," + mC + "," + mD);
				/*if(artist_name=="Brand New"){
					console.log("y = "+mA+"x + "+bA);
					console.log("y = "+mB+"x + "+bB);
					console.log("y = "+mC+"x + "+bC);
					console.log("y = "+mD+"x + "+bD);
				}*/
				//Run through all y values, check width.
				//maxWidth = [actual width, y value, left_coll]
				maxWidth = [0,0];
				for (v=b.y;v<a.y;v++){
					if(mA>=0){
						coll_left = (v-bA)/mA;
						coll_right = (v-bD)/mD;
					} else {
						coll_left = (v-bC)/mC;
						coll_right = (v-bB)/mB;
					}
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
				mDiag = 1/boxRatio;
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
				
				/*if(diag_A.y < diag_B.y) {top_collision = diag_A;} else {top_collision = diag_B;}
				if(diag_C.y > diag_D.y) {btm_collision = diag_C;} else {btm_collision = diag_D;}*/
				if(typeof top_collision === 'undefined'){
					console.log("Error labelling "+artist_name);
					continue;
				}
				fontsize = parseInt((top_collision.x-btm_collision.x)/boxRatio);
				if(fontsize>a.y-b.y){
					fontsize = a.y-b.y;
				}
				boxHeight = fontsize;
				boxWidth = boxHeight*boxRatio;
				
				x_value_for_max_point = ctrpt.x - boxWidth/2;
				y_value_for_max_point = graph.height - maxWidth[1] + boxHeight/2;
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
				//console.log(artist_name + " - y" + " - " + mA + "," + mB + "," + mC + "," + mD);
				//Let's get our starting point, and figure out the sign of our first line.
				var start_point; //a or b
				var offset_sign; //In step 3, we need to offset. If our start point is a, we offset downwards (-1), if it is b, we offset upwards (1)
				var slope_sign; //1 or -1
				var slope = 1/boxRatio; //slope of initial line
				var mO; //This is the opposite side line
				var bO;
				var mV; //This line is horizontally opposite to O
				var bV;
				var mU; //This line is vertically opposite to V
				var bU;
				if(mA<0 && mB<0 || mA>0 && mB>0) {
					start_point = a;
					offset_sign = -1;
					if(mA>0){ //Opposite line: D -> C ^ A
						slope_sign = -1;
						mO = mD;
						bO = bD;
						mV = mC;
						bV = bC;
						mU = mA;
						bU = bA;
					}
					if(mA<0){ //Opposite line: C -> D ^ B
						slope_sign = 1;
						mO = mC;
						bO = bC;
						mV = mD;
						bV = bD;
						mU = mB;
						bU = bB;
					}
				}
				if(mC<0 && mD<0 || mC>0 && mD>0) {
					start_point = b;
					offset_sign = 1;
					if(mC>0){ //Opposite line: A -> B ^ D
						slope_sign = -1;
						mO = mA;
						bO = bA;
						mV = mB;
						bV = bB;
						mU = mD;
						bU = bD;
					}
					if(mC<0){ //Opposite line: B -> A ^ C
						slope_sign = 1;
						mO = mB;
						bO = bB;
						mV = mA;
						bV = bA;
						mU = mC;
						bU = bC;
					}
				}
				
				//Draw the line (from now on referred to as Q)
				/*RECURSIVE PART*/
				//while(true) {
				//if(artist_name == "The xx"){
				var count=0;
				last_last_fontsize = 0;
				last_fontsize = 0;
				previous_start_point = {"x":0,"y":0};
				while(true){
					count++;
					mQ = slope*slope_sign;
					bQ = start_point.y - mQ*start_point.x;
					
					//Find intersection between Q and O
					//Intersection: x = (b2-b1)/(m1-m2). line 1 = Q, line 2 = O
					intersect1 = {"x": (bO - bQ)/(mQ - mO), "y": ((mO)*(bO - bQ)/(mQ - mO))+bO};
					
					
					//New line going backwards (from now on referred to as X)
					mX = slope*slope_sign*-1;
					bX = start_point.y - mX*intersect1.x;
					
					//Find intersection between X and V
					//Intersection x = (b2-b1)/(m1-m2). line 1 = X, line 2 = V
					intersect2 = {"x": (bV - bX)/(mX - mV), "y": ((mV)*(bV - bX)/(mX - mV))+bV};
					
					//Check if we're out of our bounds
					if(intersect2.x < topleft.x || intersect2.x > topright.x){
						intersect2.x = (intersect2.y - bU)/mU;
					}
					
					previous_start_point = start_point;
					start_point = {"x": intersect2.x, "y": mU*intersect2.x + bU};
					
					//Check for bounces
					if(Math.round(intersect1.y-previous_start_point.y) == last_last_fontsize){
						//console.log("Found a bounce at "+count);
						//console.log(previous_start_point);
						break;
					}
					last_last_fontsize = last_fontsize;
					last_fontsize = Math.round(intersect1.y-previous_start_point.y);
					
					if(count==100){
						//console.log("FINAL VALUE: "+(intersect1.y-previous_start_point.y));
						console.log("Ran into problems trying to place label for "+artist_name);
						break;
					} else {
						//console.log(intersect1.y-previous_start_point.y);
					}
					}
				fontsize = Math.round(Math.abs(intersect1.y-previous_start_point.y));
				x_value_for_max_point = Math.min(start_point.x,intersect1.x,intersect2.x);
				y_value_for_max_point = graph.height - Math.min(start_point.y,intersect1.y,intersect2.y);
				//}
				//fontsize = 25;
				
			}
			
			
			// TYPE: z
			// DESCRIPTION: Enclosed area
			// APPROACH: Find the midpoint between topright and btmright, and the midpoint of topleft and btmleft, then draw a line between the two midpoints
			// 			and find the midpoint of THAT line. Then keep the text centered on this point and expand it until it's sized properly.
			// MP formula: (x+x)/2 , (y+y)/2
			else if((mA>0)&&(mB<0)&&(mC<0)&&(mD>0)){
				//console.log(artist_name + " - z" + " - " + mA + "," + mB + "," + mC + "," + mD);
				
				//Get all the midpoints
				rightMP = {"x": (topright.x+btmright.x)/2, "y" : (topright.y+btmright.y)/2};
				leftMP = {"x": (topleft.x+btmleft.x)/2, "y" : (topleft.y+btmleft.y)/2};
				middleMP = {"x": (leftMP.x+rightMP.x)/2, "y" : (leftMP.y+rightMP.y)/2};
				

				
				//Base font size
				fontsize = 6;
				while(true){
					//Moving out from the center point, increase the font size and check for collisions
					boxHeight = fontsize;
					boxWidth = boxHeight*boxRatio;
						
					//Get a y value for the top and bottom of the constraint box
					boxTop = middleMP.y + boxHeight/2;
					boxBottom = middleMP.y - boxHeight/2;
					//Check left and right collisions, distance between them
					//Top
					coll_A = (boxTop-bA)/mA;
					coll_C = (boxTop-bC)/mC;
					coll_left = Math.max(coll_A,coll_C);
					
					coll_B = (boxTop-bB)/mB;
					coll_D = (boxTop-bD)/mD;
					coll_right = Math.min(coll_B,coll_D);
					
					boxTopWidth = coll_right-coll_left;
					
					//Bottom
					coll_A = (boxBottom-bA)/mA;
					coll_C = (boxBottom-bC)/mC;
					coll_left = Math.max(coll_A,coll_C);
					
					coll_B = (boxBottom-bB)/mB;
					coll_D = (boxBottom-bD)/mD;
					coll_right = Math.min(coll_B,coll_D);
					
					boxBtmWidth = coll_right-coll_left;
					
					//If we've overstepped our boundaries
					if(Math.min(boxBtmWidth,boxTopWidth)<boxWidth){
						break;
					}
					
					//Otherwise, increase the font size.
					fontsize+=2;
				}
				
				x_value_for_max_point = middleMP.x - boxWidth/2;
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
			
			d3.select("#ex1").select("svg").append("text").text(artist_name).attr("x",x_value_for_max_point).attr("y",y_value_for_max_point).attr("font-size",fontsize);//.attr("fill","white");
			//document.getElementById("band_names").innerHTML += "<span id='"+selected_artist+"' style='position:absolute;top:"+y_value_for_max_point+";left:"+x_value_for_max_point+"'>"+artist_name+"</span>";
		}
	}
	$('#box_1').css("display","none");
	$('#box_2').css("display","block");
}