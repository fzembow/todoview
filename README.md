# Todoview

A simple viewer for all TODOs in files in a directory, for the times you don't want to use bug trackers:

![todoview UI](docs/todoview.png)

## Background

Many programmers I know like to leave TODOs in their code to keep track of cleanup work to be done later, or to plan out how something will be implemented before writing code. It's a lightweight to keep track of what needs to be done.

If you're a vim user, you know that vim highlights the phrase "TODO" wherever it appears:

![vim highlighting of TODOs](docs/vim.png)

But it's not ideal -- it's hard to see a high-level view of all outstanding TODOs across a project's directory. While you can run `find ./ -type f -print | xargs grep -n '^\s*\/\/\s*TODO'` on unix systems to get a dump of where TODOs appear, todoview brings up a nice webpage view of your TODOs.

## Installation and Usage

First, install todoview:

`npm install todoview -g`

Then, run `todoview` in the directory in which you are working. A browser window will open, displaying the TODOs in the directory.

## Acknowledgments

Thanks to [allain](https://github.com/allain) for helpful contributions!
