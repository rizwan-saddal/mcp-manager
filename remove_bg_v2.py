from PIL import Image
import sys

def remove_background(input_path, output_path):
    print(f"Processing {input_path}...")
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    width, height = img.size
    pixels = img.load()
    
    # Queue for BFS: (x, y)
    queue = [(0, 0), (width-1, 0), (0, height-1), (width-1, height-1)] 
    seen = set(queue)
    
    tolerance = 25 # Increased tolerance slightly for rays
    
    while queue:
        x, y = queue.pop(0)
        
        r, g, b, a = pixels[x, y]
        
        # Check if "Black enough"
        if r < tolerance and g < tolerance and b < tolerance:
            # Make transparent
            pixels[x, y] = (0, 0, 0, 0)
            
            # Add neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in seen:
                    nr, ng, nb, na = pixels[nx, ny]
                    if nr < tolerance and ng < tolerance and nb < tolerance:
                         seen.add((nx, ny))
                         queue.append((nx, ny))
    
    img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    remove_background(
        sys.argv[1],
        sys.argv[2]
    )
