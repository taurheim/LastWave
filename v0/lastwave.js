var selected_user = prompt("User Name","taurheim");
var selected_artist = "Kanye West"//prompt("Artist to Graph","Kanye West");



xmlhttp=new XMLHttpRequest();
xmlhttp.open("GET","http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user="+selected_user+"&api_key=27ca6b1a0750cf3fb3e1f0ec5b432b72",false);
xmlhttp.send();
userinfo = xmlhttp.responseXML;
var time_start = round_week(userinfo.getElementsByTagName("registered")[0].getAttribute('unixtime'))-302400-604800;
var time_end = time_start+604800;
var current_time = round_week((new Date).getTime()/1000);

//User Data variable. Store all the information here, then graph it.
var userdata = {
}

//Calculate how many weeks the user has been on last.fm (we're going to run through the loop for every week)
var total_weeks = Math.ceil((current_time-time_start)/604800);

//Run through every week, adding artists as we go
for(w=1;w<total_weeks;w++){
	document.write("compiling week "+w+"<br/>");
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
		userdata[artist][w-1] = [w-1,0];
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
		if((userdata[artist_name]!=undefined) || (parseInt(artist_plays)>=5)){
			if(userdata[artist_name] == undefined){
				//Add an artist if the artist didn't previously exist, fill all previous values with 0s
				userdata[artist_name] = [];
				for(n=0;n<w;n++){
					userdata[artist_name][n] = [n,0]
				}
			}
			
			//Add the data to userdata
			userdata[artist_name][w-1] = [w-1,parseInt(artist_plays)];
		}
	}
}

function round_week(n){
if(n > 0)
        return Math.ceil(n/604800.0) * 604800;
    else if( n < 0)
        return Math.floor(n/604800.0) * 604800;
    else
        return 604800;
}