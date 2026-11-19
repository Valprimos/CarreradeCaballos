#!/bin/sh
# Ejecutar desde la carpeta del repositorio clonado.
git rm oros/*.svg copas/*.svg espadas/*.svg bastos/*.svg dorso/card_back.svg
git commit -m "Quitar los SVG originales para aligerar el repositorio"
