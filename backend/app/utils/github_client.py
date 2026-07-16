import urllib.request
import json
import re

def parse_github_username(url: str) -> str:
    if not url:
        return ""
    # Regex to extract username from github.com/username
    match = re.search(r"github\.com/([^/]+)", url)
    if match:
        return match.group(1).strip()
    return url.replace("https://github.com/", "").replace("http://github.com/", "").strip("/")

def fetch_github_profile_data(github_url: str) -> dict:
    username = parse_github_username(github_url)
    if not username:
        return {"error": "Invalid GitHub username"}

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    
    try:
        # Fetch user info
        user_req = urllib.request.Request(f"https://api.github.com/users/{username}", headers=headers)
        with urllib.request.urlopen(user_req, timeout=5) as response:
            user_data = json.loads(response.read().decode())
        
        # Fetch repos info
        repos_req = urllib.request.Request(f"https://api.github.com/users/{username}/repos?sort=updated&per_page=5", headers=headers)
        with urllib.request.urlopen(repos_req, timeout=5) as response:
            repos_data = json.loads(response.read().decode())
            
        repos_list = []
        for repo in repos_data:
            repos_list.append({
                "name": repo.get("name"),
                "description": repo.get("description"),
                "language": repo.get("language"),
                "stars": repo.get("stargazers_count"),
                "url": repo.get("html_url")
            })

        return {
            "username": username,
            "bio": user_data.get("bio"),
            "public_repos_count": user_data.get("public_repos"),
            "followers": user_data.get("followers"),
            "repos": repos_list
        }
    except Exception as e:
        print(f"Error fetching GitHub profile: {e}")
        # Return fallback or structured message if rate-limited
        return {
            "username": username,
            "error": str(e),
            "note": "Could not contact GitHub API. Proceeding with URL verification only."
        }
