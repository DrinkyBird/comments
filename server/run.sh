#!/usr/bin/env bash

function run {
	node index.js
	sleep 3
	run
}

run
