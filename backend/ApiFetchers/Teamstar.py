import logging

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.wait import WebDriverWait
import selenium.webdriver.support.expected_conditions as EC 

base_url = "https://comp.teamstar.team/fixtures/hwa"

teamstar_logger = logging.Logger('Teamstar')
teamstar_logger.setLevel(logging.INFO)

def get_teamstar():
    driver = webdriver.Firefox()
    driver.get(base_url)
    button = WebDriverWait(driver, 10).until(EC.visibility_of_element_located((By.CSS_SELECTOR, '.baTaQaNaR0')))
    print(button.text)
    button.click()
    driver.maximize_window()
    
if __name__ == '__main__':
    get_teamstar()