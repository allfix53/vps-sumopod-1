"""
title: Git Operations
author: openwebui-admin
version: 0.2.0
description: Clone, pull, commit, push, and manage Git repositories. Read and write files in repos.
"""

import subprocess
import os


import re


class Tools:
    def __init__(self):
        self.workspace = "/workspace"
        self.token = os.environ.get("GITHUB_TOKEN", "")
        self.username = os.environ.get("GITHUB_USERNAME", "")

    def _run(self, cmd: list[str], cwd: str = None) -> str:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120,
                cwd=cwd,
            )
            output = result.stdout.strip()
            if result.returncode != 0:
                err = result.stderr.strip()
                return f"Error (exit {result.returncode}):\n{err}"
            return output if output else "(no output)"
        except subprocess.TimeoutExpired:
            return "Error: command timed out (120s)"
        except Exception as e:
            return f"Error: {e}"

    def _repo_path(self, repo_name: str) -> str:
        safe = repo_name.replace("/", "_").replace("..", "").strip()
        return os.path.join(self.workspace, safe)

    def _to_https(self, repo_url: str) -> str:
        """Convert SSH URL to HTTPS if needed."""
        # git@github.com:user/repo.git -> https://github.com/user/repo.git
        m = re.match(r"git@github\.com:(.+)", repo_url)
        if m:
            repo_url = f"https://github.com/{m.group(1)}"
        return repo_url

    def _auth_url(self, repo_url: str) -> str:
        """Convert to HTTPS and inject token for authentication."""
        repo_url = self._to_https(repo_url)
        if self.token and "github.com" in repo_url:
            repo_url = repo_url.replace("https://", f"https://{self.username}:{self.token}@")
        return repo_url

    def list_repos(self) -> str:
        """
        List all git repositories in the workspace.
        :return: List of repository names
        """
        repos = []
        if not os.path.exists(self.workspace):
            return "Workspace directory does not exist."
        for name in sorted(os.listdir(self.workspace)):
            path = os.path.join(self.workspace, name)
            if os.path.isdir(path) and os.path.isdir(os.path.join(path, ".git")):
                repos.append(name)
        if not repos:
            return "No repositories found in workspace."
        return "Repositories:\n" + "\n".join(f"- {r}" for r in repos)

    def git_clone(self, repo_url: str) -> str:
        """
        Clone a GitHub repository into the workspace.
        :param repo_url: The URL of the repository. Supports both HTTPS (https://github.com/user/repo.git) and SSH (git@github.com:user/repo.git) formats.
        :return: Clone result
        """
        https_url = self._to_https(repo_url)
        repo_name = https_url.rstrip("/").split("/")[-1].replace(".git", "")
        dest = self._repo_path(repo_name)
        if os.path.exists(dest):
            return f"Repository '{repo_name}' already exists at {dest}. Use git_pull to update."
        auth_url = self._auth_url(repo_url)
        result = self._run(["git", "clone", auth_url, dest])
        # Mask token from output
        if self.token:
            result = result.replace(self.token, "***")
        # Configure git identity
        if os.path.isdir(dest):
            self._run(["git", "config", "user.name", self.username], cwd=dest)
            self._run(["git", "config", "user.email", f"{self.username}@users.noreply.github.com"], cwd=dest)
        return result

    def git_status(self, repo_name: str) -> str:
        """
        Show git status of a repository.
        :param repo_name: Name of the repository in the workspace
        :return: Git status output
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        return self._run(["git", "status"], cwd=path)

    def git_pull(self, repo_name: str) -> str:
        """
        Pull latest changes from remote.
        :param repo_name: Name of the repository in the workspace
        :return: Git pull output
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        return self._run(["git", "pull"], cwd=path)

    def git_add_commit(self, repo_name: str, message: str, files: str = ".") -> str:
        """
        Stage files and create a commit.
        :param repo_name: Name of the repository in the workspace
        :param message: Commit message
        :param files: Files to stage, space-separated. Default "." stages all changes
        :return: Commit result
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        file_list = files.split()
        add_result = self._run(["git", "add"] + file_list, cwd=path)
        if add_result.startswith("Error"):
            return f"git add failed: {add_result}"
        return self._run(["git", "commit", "-m", message], cwd=path)

    def git_push(self, repo_name: str, branch: str = "") -> str:
        """
        Push commits to remote.
        :param repo_name: Name of the repository in the workspace
        :param branch: Branch to push. Leave empty for current branch
        :return: Push result
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        cmd = ["git", "push"]
        if branch:
            cmd += ["origin", branch]
        result = self._run(cmd, cwd=path)
        if self.token:
            result = result.replace(self.token, "***")
        return result

    def git_diff(self, repo_name: str, staged: bool = False) -> str:
        """
        Show uncommitted changes in a repository.
        :param repo_name: Name of the repository in the workspace
        :param staged: If true, show staged changes (--cached)
        :return: Diff output
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        cmd = ["git", "diff"]
        if staged:
            cmd.append("--cached")
        return self._run(cmd, cwd=path)

    def git_log(self, repo_name: str, count: int = 10) -> str:
        """
        Show recent commit history.
        :param repo_name: Name of the repository in the workspace
        :param count: Number of commits to show (default 10)
        :return: Commit log
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        return self._run(["git", "log", f"--oneline", f"-{count}"], cwd=path)

    def git_branch(self, repo_name: str, branch_name: str = "") -> str:
        """
        List branches or create a new branch.
        :param repo_name: Name of the repository in the workspace
        :param branch_name: If provided, create and switch to this branch. If empty, list branches
        :return: Branch info
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        if branch_name:
            return self._run(["git", "checkout", "-b", branch_name], cwd=path)
        return self._run(["git", "branch", "-a"], cwd=path)

    def git_checkout(self, repo_name: str, branch: str) -> str:
        """
        Switch to a branch.
        :param repo_name: Name of the repository in the workspace
        :param branch: Branch name to switch to
        :return: Checkout result
        """
        path = self._repo_path(repo_name)
        if not os.path.isdir(path):
            return f"Repository '{repo_name}' not found."
        return self._run(["git", "checkout", branch], cwd=path)

    def read_file(self, repo_name: str, file_path: str) -> str:
        """
        Read the contents of a file from a repository.
        :param repo_name: Name of the repository in the workspace
        :param file_path: Relative path to the file inside the repo
        :return: File contents
        """
        path = self._repo_path(repo_name)
        full_path = os.path.join(path, file_path)
        if not os.path.isfile(full_path):
            return f"File not found: {file_path}"
        try:
            with open(full_path, "r") as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {e}"

    def write_file(self, repo_name: str, file_path: str, content: str) -> str:
        """
        Write or overwrite a file in a repository.
        :param repo_name: Name of the repository in the workspace
        :param file_path: Relative path to the file inside the repo
        :param content: The full content to write to the file
        :return: Success or error message
        """
        path = self._repo_path(repo_name)
        full_path = os.path.join(path, file_path)
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w") as f:
                f.write(content)
            return f"File written: {file_path}"
        except Exception as e:
            return f"Error writing file: {e}"

    def list_files(self, repo_name: str, path: str = ".") -> str:
        """
        List files and directories in a repository path.
        :param repo_name: Name of the repository in the workspace
        :param path: Relative directory path inside the repo. Default "." for root
        :return: List of files and directories
        """
        repo_path = self._repo_path(repo_name)
        full_path = os.path.join(repo_path, path)
        if not os.path.isdir(full_path):
            return f"Directory not found: {path}"
        try:
            entries = []
            for name in sorted(os.listdir(full_path)):
                if name.startswith(".git") and path == ".":
                    continue
                entry_path = os.path.join(full_path, name)
                if os.path.isdir(entry_path):
                    entries.append(f"📁 {name}/")
                else:
                    size = os.path.getsize(entry_path)
                    entries.append(f"📄 {name} ({size} bytes)")
            if not entries:
                return "Directory is empty."
            return "\n".join(entries)
        except Exception as e:
            return f"Error listing files: {e}"
