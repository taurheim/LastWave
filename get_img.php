<?php
	require 'mysql_connect.php';

	$query = "SELECT * FROM wave_db";
	$result = @mysqli_query($con,$query);

	$data = mysqli_fetch_array($result);

	echo "<script type='text/javascript'> var heh = " . json_encode($data) . ";
    //this will output the contents of wordsArray into the console
     console.log(heh);

     // check the console. f12 or ctrl+shift+k
 </script>";
?>