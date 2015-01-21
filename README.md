# LastWave
Graph your music listening history!
![An Example Graph](http://i.imgur.com/jMQoqg6.png)

## What does it do?
LastWave is a web-app that takes data from your last.fm profile and creates a beautiful wave graph that represents your music listening trends by artist. The artists that you listen to more at a given time has a larger area on the graph.

## How does it work?
LastWave is built almost entirely in JavaScript, although some of the exporting process is handled with PHP. The wave created by LastWave is rendered entirely in the browser in svg format, and LastWave allows you to export this wave to multiple sources, including saving it as an image to the web.
The majority of the creation of the wave graph is done by libraries, but the text placement is done manually by LastWave. This is accomplished with a series of algorithms that are detailed in my blog post <http://savas.ca/blog/lastwave-1-text-placement/>

## How to contribute
LastWave is always looking for people to help with the code! This is a great beginner-intermediate project as there are lots of little things that need doing. Check out the "issues" section to see what needs to be done! I've tried to make it pretty clear how difficult each one is, but if you have any questions, just contact me at niko@savas.ca!

## Libraries used in LastWave
##### Rickshaw.js & d3.js
These two libraries are used to create the wave graph graphic itself. Some tweaks were made to the way these libraries were used, but they've mostly been left intact
##### Canvg
Used to parse the SVG created by Rickshaw.js and d3.js so that we can export the image either to imgur or in SVG format
##### jQuery
Basic JavaScript library to speed up development by providing many useful functions
##### jQuery UI
Used for the LastWave's calendar date selector
##### jQuery imagePicker
Used to select the wave "type" on the main screen
##### jQuery MiniColors
Color selector for LastWave (found under extra options).
##### Lightbox JS
Used in the LastWave gallery.
