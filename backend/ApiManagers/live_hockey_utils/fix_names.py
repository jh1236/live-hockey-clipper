import re
from datetime import datetime

from utils import NUMBERS


def get_comp_details(comp) -> tuple[str, str, int]:
    this_year = datetime.now().year
    comp = re.sub(r'^[\d\s]*wa ', '', comp.lower()).strip()
    if comp.startswith("j"):
        # Juniors
        comp = comp[2:]  # remove the J and the trailing space
        age, comp_and_div = comp.split(' ', 1)
        gender = 'M' if comp_and_div.split(' ')[-1] == 'boys' else 'F'
        comp_and_div = comp_and_div.replace('division ', '')
        comp_and_div = comp_and_div.split(' ')[:-1]

        if len(comp_and_div) > 1:
            # this grade has black and Gold
            comp_and_div, grade = comp_and_div
            grade = re.sub('[()]', '', grade)
            comp = f'{age} Div {NUMBERS[int(comp_and_div[0])]} {grade}'
        else:
            comp = f'{age} Div {NUMBERS[int(comp_and_div[0])]}'
    else:
        if comp.startswith('r'):
            # this is rae blunt - and it doesn't have a dash before the gender (god knows why)
            comp = comp.replace('women', '- women')
        comp, gender = comp.split(' - ')
        comp = comp.strip()
        gender = 'F' if 'women' in gender else 'M'
        if comp.startswith("o") or comp.startswith("r"):
            # Masters
            comp.replace('div div', 'div')
            if 'pool' not in comp:
                if comp[0] == 'r':
                    # edge case for o35 d1
                    age = 'o35'
                    div = '1'
                elif comp == 'o35 midweek':
                    age = 'o35'
                    div = '1'
                else:
                    age, div = comp.replace(' div', '').split(' ')
                comp = f'{age} Div {NUMBERS[int(div)]}'
        elif 'premier' in comp:
            # premier divisions
            if any([i in comp for i in ['2', 'two']]):
                comp = 'Prem Two'
            if any([i in comp for i in ['3', 'three']]):
                comp = 'Prem Three'
            else:
                comp = 'Prem One'
        else:
            # Seniors
            grade_number = re.sub('div(ision)? ', '', comp).strip()
            if ' ' in grade_number:
                grade_number, black_or_gold = grade_number.split(' ')
                black_or_gold = re.sub('[()]', '', black_or_gold)
                comp = f'Div {NUMBERS[int(grade_number)]} {black_or_gold}'
            else:
                comp = f'Div {NUMBERS[int(grade_number)]}'

    return comp.title(), gender, this_year
