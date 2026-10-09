from agents.node import graph
from pathlib import Path
import os

png_data = graph.get_graph().draw_mermaid_png()

image_path = Path("graph.png")
image_path.write_bytes(png_data)

# os.startfile(image_path.resolve())