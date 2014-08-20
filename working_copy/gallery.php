<?php
	require 'mysql_connect.php';
	$page = $_GET['page'];
	if(!isset($_GET['page'])) $page = 0; 
	else $page = $_GET['page'];

	$query = "SELECT * FROM wave_db";
	$result = @mysqli_query($con,$query);

	$array = array();
	$users = array();
	$urls = array();

	while(($sqlrow =  mysqli_fetch_array($result))) {
		$array[] = array($sqlrow['username'],$sqlrow['url']);
	}
	$array = array_reverse($array);

	foreach($array as $row){
		if(in_array($row[0], $users)){
			continue;
		} else {
	    	$urls[] = $row[1];
	    	$users[] = $row[0];
		}
	}

	$urls = array_chunk($urls, 9);
?>

<!DOCTYPE html>
<html>
<!--
This is a proof-of-concept demo for saving d3js graphics as PDF/PNG/SVG files.

Copyright (C) 2012 by A. Gordon (gordon at cshl dot edu)
All code written by me is released under BSD license: http://opensource.org/licenses/BSD-3-Clause
(also uses several other libraries that have their own licenses).

See here for more details:
	https://github.com/agordon/d3export_demo

See here for online demo:
	http://d3export.cancan.cshl.edu/

-->
<head>
<title>LastWave - Gallery</title>
<link type="text/css" rel="stylesheet" href="css.css">
<link href="http://netdna.bootstrapcdn.com/bootswatch/3.1.1/yeti/bootstrap.min.css" rel="stylesheet">
<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js"></script>
<script src="lastwave_gallery.js"></script>
<script src="lightbox.min.js"></script>
<link href="lightbox.css" rel="stylesheet" />
<link rel="icon" 
      type="image/png" 
      href="http://savas.ca/lastwave/favicon.ico">
<script>
	var jsonarray = <?php echo json_encode($urls); ?>;
	var current_page = <?php echo $page;?>;

$(document).ready(function() {
	load_page(<?php echo $page;?>);
});

function load_page(page){
	document.getElementById("gallery").innerHTML = "";
	current_page = page;
	for(img in jsonarray[page]){
		document.getElementById("gallery").innerHTML += "<span><a href='"+jsonarray[page][img]+"' data-title='<a href=\""+jsonarray[page][img]+"\">View Full Size</a>' data-lightbox='image-"+img+"'><img src='"+jsonarray[page][img].replace(".jpg","m.jpg")+"'/></a></span>";
	}
}

function back(){
	if(current_page!=0){
		load_page(current_page-1);
	}
}
function next(){
	if(current_page!= (jsonarray.length-1)){
		load_page(current_page+1);
	}
}
</script>
</head>
<body>

<div class="titlebar">
	<img class="center_block" src="logo.png">
	<div id="menu" class="center_block">
			<a href="index.html">Home</a>
			<a href="gallery.php">Gallery</a>
			<a href="donate.html">Donate!</a>
			<a href="about.html">About</a>
	</div>
</div>
<div id="gallery_container" class="center_block">
<div id="gallery_nav_left">
<img src="images/left-arrow.png" onclick="back()"/>
</div>
<div id="gallery" class="center_block">

</div>
<div id="gallery_nav_right">
<img src="images/right-arrow.png" onclick="next()"/>
</div>
</div>
</body>
</html>