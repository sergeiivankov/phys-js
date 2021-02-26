import {
  BODIES_TYPES
} from './common';

/**
 * Значение сдвига для рассчета идентификаторов регионов
 * Размер региона = 2 в степени regionsShift
 *
 * @type  {Number}
 */
const regionsShift = 9;

/**
 * Расчет координат регионов для тела
 *
 * @param   {Object}  bounds  Объект с координатами обрамляющего тело
 *                            прямоугольника
 * @return  {Array}           Массив с идентификаторами регионов
 */
const getRegions = bounds => {
  const regions = [];

  const sx = bounds.min.x >> regionsShift;
  const sy = bounds.min.y >> regionsShift;
  const ex = bounds.max.x >> regionsShift;
  const ey = bounds.max.y >> regionsShift;

  for(let y = sy; y <= ey; y++) {
    for(let x = sx; x <= ex; x++) {
      regions.push(x + ':' + y);
    }
  }

  return regions;
};

/**
 * Генерация идентификатора для пары тел
 *
 * @param   {Number}  bodyAId  Идентификатор первого тела
 * @param   {Number}  bodyBId  Идентификатор второго тела
 * @return  {String}           Строковый идентификатор
 */
const getPairId = (bodyAId, bodyBId) => {
  return bodyAId < bodyBId
    ? bodyAId + ':' + bodyBId
    : bodyBId + ':' + bodyAId;
};

/**
 * Определяет возможно ли столкновение тел
 *
 * @param   {Body}     bodyA  Первое тело
 * @param   {Body}     bodyB  Второе тело
 * @return  {Boolean}         Результат
 */
const canCollide = (bodyA, bodyB) => {
  // Сталкиваться не могут динаковые типы
  if(bodyA.type === bodyB.type) return false;

  // Упругие тела не могут сталкиваться с телами игроков и пулями
  // Но могут со статическими объектами
  if(bodyA.type === BODIES_TYPES.BOUNCE &&
     bodyB.type !== BODIES_TYPES.STATIC) return false;
  if(bodyB.type === BODIES_TYPES.BOUNCE &&
     bodyA.type !== BODIES_TYPES.STATIC) return false;

  // Пули не могут сталкиваться с телом владельца
  if(bodyA.type === BODIES_TYPES.BULLET &&
     bodyA.ownerId === bodyB.id) return false;
  if(bodyB.type === BODIES_TYPES.BULLET &&
     bodyB.ownerId === bodyA.id) return false;

  // Иначе могут сталкиваться
  return true;
};

/**
 * Хранилище пар объектов для расчета столкновений
 */
class Grid {
  constructor() {
    // Список пар тел для проверки столкновений
    // Каждое свойство - идентификатор пары
    //        значение - объект с информацией о паре
    this.pairs = {};

    // Список хэшей
    // Каждое свойство - идентификатор региона
    //        значение - массив тел в этом регионе
    this.hash = {};
  }

  /**
   * Обновление регионов для тел физического мира
   *
   * @param  {Array}  bodies  Массив тел для обновления регионов
   */
  update(bodies) {
    for(let i = 0, l = bodies.length; i < l; i++) {
      const body = bodies[i];

      // Если у тела нет регионов, создаем и переходим к следующему,
      // так как регионы не меняются на текущий тик
      if(!body.regions) {
        this._addBody(body);
        continue;
      }

      // Статическое тело не изменяется
      if(body.type === BODIES_TYPES.STATIC) continue;

      // Если тело было обновлено
      if(body.isUpdated) {
        // Сбрасываем значение обновления
        if(body.type !== BODIES_TYPES.BULLET) body.isUpdated = false;

        // Получаем список регионов
        const regions = getRegions(body.bounds);
        const regionsString = regions.join(',');
        // Если старый список регионов не равен новому
        if(regionsString != body.regionsString) {
          // Обновляем пары для тела
          this._updateBody(body, regions, regionsString);
        }
      }
    }
  }

  /**
   * Добавление тела в список сетки и создание пар для проверки коллизий
   *
   * @param  {Body}  body  Тело для добавления
   */
  _addBody(body) {
    // Получение и установка списка регионов в свойство объекта
    const regions = getRegions(body.bounds);
    body.regions = regions;
    // Для не статических тел добавляем строковое представление списка регионов
    // Для ускорения проверки смены региона
    if(body.type !== BODIES_TYPES.STATIC) {
      body.regionsString = regions.join(',');
    }

    // Для каждого из регионов добавление объекта в хэш
    for(let i = 0, l = regions.length; i < l; i++) {
      const region = regions[i];
      // Если хэш есть, добавляем объект в массив тел
      if(this.hash[region]) this.hash[region].push(body);
      // Иначе содаем массив по хэшу
      else this.hash[region] = [ body ];
    }

    // Создание пар для проверки коллизий для объекта
    this._addPairs(body);
  }

  /**
   * Обновление регионов тела, обновление хэшей и списка коллизий
   *
   * @param  {Body}    body           Тело для обновления
   * @param  {Array}   newRegions     Массив идентификаторов новых регионов
   * @param  {String}  regionsString  Строковое представление
   *                                  списка идентификаторов регионов
   */
  _updateBody(body, newRegions, regionsString) {
    const oldRegions = body.regions;

    // Получение списка регионов для удаления
    // (регионов которые есть в старых и нет в новых)
    const regionsToRemove = oldRegions.filter(value => {
      return newRegions.indexOf(value) === -1;
    });
    // Получение списка регионов для добавления
    // (регионов которые есть в новых, но нет в старых)
    const regionsToAdd = newRegions.filter(value => {
      return oldRegions.indexOf(value) === -1;
    });

    // Если есть регионы для удаления
    if(regionsToRemove.length) {
      for(let i = 0, l = regionsToRemove.length; i < l; i++) {
        const region = regionsToRemove[i];
        const hash = this.hash[region];

        // Удаление из хэшей
        const index = hash.indexOf(body);
        if(index > -1) hash.splice(index, 1);
      }

      // Удаление из пар
      this._removePairs(body, regionsToRemove);
    }

    // Если есть регионы для добавления
    if(regionsToAdd.length) {
      for(let i = 0, l = regionsToAdd.length; i < l; i++) {
        const region = regionsToAdd[i];

        // Добавление тела в список хэшей новых регионов
        if(this.hash[region]) this.hash[region].push(body);
        else this.hash[region] = [ body ];
      }

      // Добавление в пары новых регионов
      this._addPairs(body, regionsToAdd);
    }

    // Устанвока телу списка новых регионов
    body.regions = newRegions;
    body.regionsString = regionsString;
  }

  /**
   * Удаление тела из хэшей и пар для проверки столкновений
   *
   * @param  {Body}  body  Тело для удаления
   */
  removeBody(body) {
    const regions = body.regions;
    if(!regions) return;

    for(let i = 0, l = regions.length; i < l; i++) {
      const region = regions[i];
      const hash = this.hash[region];
      if(!hash) continue;

      // Удаление тела из хэшей
      const index = hash.indexOf(body);
      if(index > -1) hash.splice(index, 1);
    }

    // Удаление тела из пар для проверки столкновений
    this._removePairs(body);
    // Удаление свойств регионов у тела
    delete(body.regions);
    delete(body.regionsString);
  }

  /**
   * Добавление тела в пары для проверки столкновений
   *
   * @param  {Body}   body       Тело для добавления
   * @param  {Array}  [regions]  Регионы для добавления
   */
  _addPairs(body, regions) {
    // Если передан параметр регионов для добавления,
    // использует их, иначе - регионы тела
    regions = regions || body.regions;

    for(let i = 0, iL = regions.length; i < iL; i++) {
      const region = regions[i];

      // Получение списка тел по хэшу
      const regionBodies = this.hash[region];
      for(let j = 0, jL = regionBodies.length; j < jL; j++) {
        const otherBody = regionBodies[j];
        // Если идентификаторы совпадают, переходим к следующему
        if(otherBody.id === body.id) continue;
        // Если тела не могут столкнуться, переходи к следующему
        if(!canCollide(body, otherBody)) continue;

        // Получение идентификатора пары тел
        const pairId = getPairId(body.id, otherBody.id);
        // Если пара есть, увеличиваем счетчик
        // Счетчик необходим для корректного перехода тела между регионами
        if(this.pairs[pairId]) this.pairs[pairId].count++;
        // Иначе добавляем объект пары
        else {
          this.pairs[pairId] = {
            id: pairId,
            bodyA: body,
            bodyB: otherBody,
            count: 1
          };
        }
      }
    }
  }

  /**
   * Удаление тела из пар для проверки столкновений
   *
   * @param  {Body}   body       Тело для удаления
   * @param  {Array}  [regions]  Регионы для удаления
   */
  _removePairs(body, regions) {
    // Если передан параметр регионов для удаления,
    // использует их, иначе - регионы тела
    regions = regions || body.regions;

    for(let i = 0, iL = regions.length; i < iL; i++) {
      const region = regions[i];

      // Получение списка тел по хэшу
      const regionBodies = this.hash[region];
      for(let j = 0, jL = regionBodies.length; j < jL; j++) {
        const otherBody = regionBodies[j];

        // Получение идентификатора пары тел
        const pairId = getPairId(body.id, otherBody.id);
        // Если есть пара с таким идентификатором
        if(this.pairs[pairId]) {
          // Если счетчик пары равен 1, удаляем ее
          if(this.pairs[pairId].count === 1) delete(this.pairs[pairId]);
          // Иначе уменьшаем счетчик на 1
          else this.pairs[pairId].count--;
        }
      }
    }
  }
}

export default Grid;
