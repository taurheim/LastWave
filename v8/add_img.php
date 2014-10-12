<?php
	require 'mysql_connect.php'; 
	
	//Absolutely Necessary
	$url = $_POST['img_url'];

	//Might as well gather some extra data
	$user = $_POST['user']; //username
	$weeks = $_POST['weeks']; //Number of weeks counted
	$artistcount = $_POST['artistcount'];

    if(is_valid_url($url) && is_valid_user($user) && is_numeric($weeks) && is_numeric($artistcount)){
        $query = "INSERT INTO wave_db (username,url,weeks,artistcount) VALUES ('$user','$url',$weeks,$artistcount)";
        $result = @mysqli_query($con,$query);
        echo json_encode ("Added image to gallery.");
    } else {
    	echo json_encode ("Errors");
    }

	mysqli_close($con);


?>