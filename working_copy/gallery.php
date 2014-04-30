<?php
	require 'mysql_connect.php';

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
<title>LastWave Gallery</title>
<link type="text/css" rel="stylesheet" href="css.css">
<link href="http://netdna.bootstrapcdn.com/bootswatch/3.1.1/yeti/bootstrap.min.css" rel="stylesheet">
<script src="http://ajax.googleapis.com/ajax/libs/jquery/1.8.2/jquery.min.js"></script>
<script src="lastwave_gallery.js"></script>
<script src="lightbox.min.js"></script>
<link href="lightbox.css" rel="stylesheet" />
<script>
var jsonarray = <?php echo json_encode($urls); ?>

$(document).ready(function() {
	for(img in jsonarray){
		document.getElementById("gallery").innerHTML += "<span><a href='"+jsonarray[img]+"' data-title='<a href=\""+jsonarray[img]+"\">View Full Size</a>' data-lightbox='image-"+img+"'><img src='"+jsonarray[img]+"'/></a></span>";
	}
});
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
<div id="gallery" class="center_block">

</div>
</body>
</html>