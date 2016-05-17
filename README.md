# Extract CSS block plugin for webpack ![Build status](https://api.travis-ci.org/i-like-robots/extract-css-block-webpack-plugin.png)

I'll admit, it's not a catchy name.

## What and why?!

Sometimes you want to separate your monolithic stylesheets into multiple files; maybe to excise critical styles or split into lazy loadable bundles.

To do this you need multiple entry points and so any context created while building each stylesheet is lost. For a flat dependency tree this may not be a problem but for more complex projects where multiple components share dependencies it can be; think duplicated output and context switching to check where or if a dependency is already used... not fun!

This plugin enables you to maintain a single entry point but mark specific blocks of rules to be extracted into separate files.

## Installation

First install the plugin and save it to your package manifest dev dependencies:

```sh
npm i --save-dev extract-css-block-webpack-plugin
```

Next apply the plugin via your webpack config. The plugin can _only_ be used with separate stylesheets and therefore _must_ be added after the extract text plugin:

```js
const ExtractCssBlockPlugin = require('extract-css-block-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract(['css', 'sass'])
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin('[name]'),
    new ExtractCssBlockPlugin()
  ]
}
```

## Basic usage

To mark blocks of rules as targets for extraction use 'loud' (`!`) start and end comments. For example, given this Sass `main.scss` entry point:

```scss
@import "shared-ui/variables";
@import "shared-ui/functions";
@import "shared-ui/mixins";

/*! start:critical.css */
@import "shared-ui/component/normalize";
@import "shared-ui/component/grid";
@import "shared-ui/component/typography";
/*! end:critical.css */

@import "component/tabs";
@import "component/modal";
@import "layout/list-page";
@import "layout/content-page";

/*! start:comments.css */
@import "component/comments";
@import "component/comment-form";
/*! end:comments.css */
```

Webpack will write 3 stylesheets:- `main.css`, `critical.css` and `comments.css`.

## Advanced usage

Blocks may be nested:

```css
/*! start:header.css */
.header {
  padding: 10px 20px;
  background: #333;
  color: #FFF;
}
/*! start:header-menu.css */
.header-menu {
  list-style: none;
  margin: 0 15px;
}
/*! end:header-menu.css */

.header-logo {
  float: left;
  border: 0;
}
/*! end:header.css */
```

Blocks may also be used many times and their contents will be aggregated:

```css
/*! start:header.css */
.header {
  padding: 10px 20px;
  background: #333;
  color: #FFF;
}
/*! end:header.css */

.header-menu {
  list-style: none;
  margin: 0 15px;
}

/*! start:header.css */
.header-logo {
  float: left;
  border: 0;
}
/*! end:header.css */
```

## Source maps

To enable source maps ensure that webpack, the CSS plugin and any preceeding pre-processors have source maps enabled:

```js
module.exports = {
  ...
  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract(['css?sourceMap', 'sass?sourceMap'])
      }
    ]
  },
  devtool: 'source-map'
}
```
