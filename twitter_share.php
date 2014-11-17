<!-- Twitter Card -->
<?php if(true) {?> <meta name="twitter:card" value="summary">
<meta name="twitter:creator" value="@ajkohn">
<meta name="twitter:url" value="<?php echo get_permalink(); ?>">
<meta name="twitter:title" value="<?php echo get_the_title(); ?>">
<meta name="twitter:description" value="<?php echo get_post_meta($post->ID, '_aioseop_description', $single = true); ?>">
<?php if(get_post_meta($post->ID, 'og_img')){ ?>
<meta name="twitter:image" value="<?php echo get_post_meta($post->ID, 'og_img', $single = true); ?>" />
<?php } else { ?>
<meta name="twitter:image" value="http://www.blindfiveyearold.com/wp-content/uploads/2008/09/blind-five-year-old-150x150.png" />
<?php } ?> <?php }?>