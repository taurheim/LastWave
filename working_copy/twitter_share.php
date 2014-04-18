<?php
    require 'library/tmhOAuth.php';
    require 'library/tmhUtilities.php';
 
   $tmhOAuth = new tmhOAuth(array(
      'consumer_key'    => 'aDpMTsgqo6nBuUmkVDglTMMnx',
      'consumer_secret' => 'GztSjUZZm6fGxTWzDyYJGevOQtwTXijrKFtuRXBJQeHeMVvyVB',
      'user_token'      => '624231854-Km5v5bZMT2PwF2bQEHe9eSMVguPuDgcknn5JmPMs',
      'user_secret'     => 'qSJFvyobQmUsL6wFNnGNnHg99WC3ljjRPnfzBKWfTl5yG',
        ));
 
   $image = $_POST['url'];
 
   if (isset($_POST['msg'])) {
      $tweetmsg = $_POST['msg'];
       $response = $tmhOAuth->request('POST', 'https://upload.twitter.com/1/statuses/update_with_media.json', array('media[]'  => "@{$image}",'status'   => "This is a status"), true, true);
 
       if($tmhOAuth) {
            echo $response;
        } else {
           echo "Your message has not been sent to Twitter.";
       }
 
   } else {
       echo "Your message has not been sent to Twitter.";
   }
?>