from bs4 import BeautifulSoup
import re
import logging
import subprocess
import json
import os
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import httpx
import asyncio

COMMAND_TIMEOUT = 10

class DuoStreamConfiguration:
    def __init__(self):
        self.duo_ip_address: str = ""  # 192.168.1.X:port
        self.duo_port: str = ""
        self.duo_host_name: str = ""
        self.mac_address: str = ""
        self.cache_file: str = os.path.join(os.path.dirname(__file__),"duostream_sessions_cache.json")
        self.duo_conf_name: str = ""
        self.cache_expiration_hours: int = -1  # Cache valable 24h
        self.logger = logging.getLogger(__name__)

class DuoStreamDevice:
    def __init__(self, configuration: DuoStreamConfiguration):
        self._configuration = configuration
        self._sessions = None

    async def _check_device_online(self) -> bool:
        """Check if the device is powered on and reachable."""
        return await self.get_power_status_computer()

    async def _check_service_running(self) -> bool:
        """Check if the Duo service is running."""
        return await self.get_duostream_service_status()

    def read_cached_sessions(self):
        """Fill the loaded cache and read cache"""
        return self._read_session_cache()

    def _read_session_cache(self) -> Optional[Dict]:
        """Read sessions from cache file."""
        try:
            self._sessions = {
                        'timestamp' : datetime.now().isoformat(),
                        'sessions' : {}
            }
            if os.path.exists(self._configuration.cache_file):
                with open(self._configuration.cache_file, 'r') as f:
                    cache_data = json.load(f)
                    self._sessions = cache_data.get(self._configuration.duo_conf_name,self._sessions)
                    # Check cache expiration
                    cached_time = datetime.fromisoformat( self._sessions.get('timestamp', ''))
                    if self._configuration.cache_expiration_hours == -1 or (datetime.now() - cached_time < timedelta(hours=self._configuration.cache_expiration_hours)):
                        return self._sessions
        except (json.JSONDecodeError, FileNotFoundError) as e:
            self._configuration.logger.error(f"Cache read error: {e}")
        return None

    def _write_session_cache(self, sessions_cache: Dict):
        """Write sessions to cache file."""
        try:
            cache_data = {}
            if os.path.exists(self._configuration.cache_file):
                with open(self._configuration.cache_file, 'r') as f:
                        cache_data = json.load(f)
            cache_data[self._configuration.duo_conf_name] = sessions_cache
            with open(self._configuration.cache_file, 'w') as f:
                json.dump(cache_data, f, indent=4)
        except Exception as e:
            self._configuration.logger.error(f"Cache write error: {e}")

    def write_session_cache(self):
        """Write sessions to cache file."""
        self._write_session_cache(self._sessions)

    async def _get_html_page_base(self) -> dict:
        """
        Retrieve the list of available streaming sessions from the Duostream web interface.
        
        Returns:
            dict: A dictionary containing information about the Duostream sessions
        """
        try:
            client = httpx.AsyncClient(verify = False)
            response = await client.get(
                    f"http://{self._configuration.duo_ip_address}:{self._configuration.duo_port}",
                    timeout=10
                )
            response.raise_for_status()
            if (response.status_code == 200 ):
                return {"status": True, "value": response}
        except httpx.HTTPError  as e:
            self._configuration.logger.error(f"Request error: {e}")
            return {"status": False, "value": str(e)}
        return {"status": False, "value": ""}

    async def get_sessions_available(self) -> List[str]:
        """
        Get available sessions, with caching mechanism.
        
        Returns:
            List of session names
        """
        # Check device and service status
        if not await self._check_device_online() or not await self._check_service_running():
            # Check cache first
            cached_data = self._read_session_cache() if self._sessions is None else self._sessions
            if cached_data and 'sessions' in cached_data:
                return [session['name'] for session in cached_data['sessions']]
            return []

        # If no valid cache, fetch from web
        html_page = await self._get_html_page_base()
        if html_page["status"] is False:
            return [session['name'] for session in self._sessions['sessions']]
        
        sessions_infos = self._parse_html_request(html_content=html_page["value"].text)
        
        # Write to cache
        self._sessions = {
                'timestamp': datetime.now().isoformat(),
                'sessions': sessions_infos
            }
        
        return [infos["name"] for infos in sessions_infos]
        
    def _parse_html_request(self,html_content) -> dict :
            """        
            Args:
                html_content (str): The HTML content to parse
                
            Returns:
                dict: A dictionary containing the parsed information
            """
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract the hostname
            hostname_div = soup.select_one('.label img[alt="Hostname"]')
            hostname = hostname_div.parent.get_text().strip() if hostname_div else "Unknown Hostname"
            
            # Extract version
            version_match = re.search(r'Duo v(\d+\.\d+\.\d+)', html_content)
            version = version_match.group(1) if version_match else "Unknown"
            
            # Extract sessions information
            sessions = []
            rows = soup.select('tbody tr.row')
            
            for row in rows:
                # Extract session name and URL
                link = row.select_one('a.sunshine-link')
                if link:
                    session_name = link.get_text().strip()
                    session_url = link.get('href')
                    
                                    
                    sessions.append({
                        "name": session_name,
                        "url" : session_url
                    })
            return sessions

    async def get_session_status(self,session_name:str) -> bool:

        if not await self._check_device_online() or not await self._check_service_running():
            self._configuration.logger.debug(f"Info: get_session_status : Request DuoStream computer or service is not activated")
            return False
        try:
            client = httpx.AsyncClient(verify = False)
            response = await client.get(f"http://{self._configuration.duo_ip_address}:{self._configuration.duo_port}/instances/{session_name}")
            response.raise_for_status()
            if response.status_code != 200:
                return False            
            return True if response.text == "true" else False
        except httpx.HTTPError as e:
            self._configuration.logger.error(f"Request error: {e}")
            return False

    async def change_session_status(self,session_name:str,new_status:bool):
        if not await self._check_device_online() or not await self._check_service_running():
            self._configuration.logger.warning(f"ERROR: Request DuoStream computer or service is not activated")
        try:
            client = httpx.AsyncClient(verify = False)
            response = await client.get(f"http://{self._configuration.duo_ip_address}:{self._configuration.duo_port}/instances/{session_name}/{"start" if new_status is True else "stop" }")
            response.raise_for_status()
        except httpx.HTTPError as e:
            self._configuration.logger.error(f"Request error: {e}")


    async def activate_duo_stream_service(self, activation: bool) -> bool:
        """
        Activate or deactivate Duo Stream service asynchronously.
        Requires device to be online.
        
        Args:
            activation (bool): True to start, False to stop service
        
        Returns:
            bool: Success of service activation/deactivation
        """
        # Mandatory device online check
        if not await self._check_device_online():
            self._configuration.logger.warning("Cannot modify service: Device offline")
            return False

        action = "start" if activation is True else "stop"
        # Build the SSH command
        ssh_command = f'ssh {self._configuration.duo_host_name}@{self._configuration.duo_ip_address} "net {action} duo"'

        try:
            # Create subprocess with asyncio
            process = await asyncio.create_subprocess_shell(
                ssh_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                shell=True,
            )
            
            try:
                # Execute with timeout
                async with asyncio.timeout(COMMAND_TIMEOUT):  # 30 seconds timeout
                    stdout, stderr = await process.communicate()
                    
                    # Check return code
                    if process.returncode == 0:
                        output = stdout.decode('utf-8', errors='replace').strip()
                        self._configuration.logger.debug(f"SSH command returned: {output}")
                        return True
                    else:
                        error = stderr.decode('utf-8', errors='replace').strip()
                        self._configuration.logger.error(
                            f"Failed to {action} Duo service. Error: {error}"
                        )
                        return False
                        
            except TimeoutError:
                self._configuration.logger.error(
                    f"SSH command timed out while attempting to {action} Duo service"
                )
                return False
                
        except Exception as e:
            self._configuration.logger.error(
                f"Unexpected error when {action}ing Duo service: {str(e)}"
            )
            return False
        finally:
            # Ensure process cleanup
            if 'process' in locals() and process:
                try:
                    process.kill()
                    if hasattr(process, '_transport'):
                        process._transport.close()
                except Exception:
                    pass


    async def get_power_status_computer(self) -> bool:
        """
        Check if computer is reachable via ping.
        
        Returns:
            bool: Computer online status
        """
        # Extract the ping command to a variable for better readability
        ping_command = f'ping {self._configuration.duo_ip_address} -c 1'
        
        try:
            # Create subprocess with timeout handling
            process = await asyncio.create_subprocess_shell(
                ping_command,
                stdin=None,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                close_fds=False,  # required for posix_spawn
            )
            
            # Handle process communication with timeout
            try:
                async with asyncio.timeout(COMMAND_TIMEOUT):
                    _, _ = await process.communicate()
                    # Return True if ping was successful (returncode 0)
                    return process.returncode == 0
            except TimeoutError:
                self._configuration.logger.debug(
                    "Timed out running command: `%s`, after: %ss", ping_command, COMMAND_TIMEOUT
                )
        finally:
            # Ensure process cleanup in all cases
            if 'process' in locals() and process:
                try:
                    process.kill()
                    # Handle Python bug: https://bugs.python.org/issue43884
                    if hasattr(process, '_transport'):
                        process._transport.close()
                except Exception:
                    pass
        return False

    async def get_duostream_service_status(self,use_ssh:bool=False) -> bool:
        """
        Get Duostream service status asynchronously.
        Requires device to be online.
        
        Returns:
            bool: Service running status (True if running, False otherwise)
        """
        # Mandatory device online check
        if not await self._check_device_online():
            self._configuration.logger.debug("Cannot check service status: Device offline")
            return False

        # Build the SSH command to check if Duo service is running
        if (use_ssh == True):
            ssh_command = f'ssh {self._configuration.duo_host_name}@{self._configuration.duo_ip_address} "net start | findstr /i Duo"'
            try:
                # Create subprocess asynchronously
                process = await asyncio.create_subprocess_shell(
                    ssh_command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    shell=True,
                )
                
                try:
                    # Execute with timeout
                    async with asyncio.timeout(20):  # 20 seconds timeout
                        stdout, _ = await process.communicate()
                        
                        # Check if service is running by looking for "Duo" in the output
                        if process.returncode == 0:
                            output = stdout.decode('utf-8', errors='replace').strip()
                            service_running = "Duo" in output
                            self._configuration.logger.debug(
                                f"Duo service is {'running' if service_running else 'not running'}"
                            )
                            return service_running
                        else:
                            # Command failed - service is likely not running
                            return False
                            
                except TimeoutError:
                    self._configuration.logger.error("SSH command timed out while checking Duo service status")
                    return False
                    
            except Exception as e:
                self._configuration.logger.error(f"Error checking Duo service status: {str(e)}")
                return False
            finally:
                # Ensure process cleanup
                if 'process' in locals() and process:
                    try:
                        process.kill()
                        if hasattr(process, '_transport'):
                            process._transport.close()
                    except Exception:
                        pass
        else :
            # If cannot get the base page it means that the service is not available 
            return (await self._get_html_page_base())["status"]


    def append_new_device_pin(self,session_name,pin_code,computer_name,sunshine_user,sunshine_password):
        ...
