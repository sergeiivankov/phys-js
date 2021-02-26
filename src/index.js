import World from './world';

/**
 * Обертка для создания физического мира
 *
 * @param   {Object}  options  Параметры конструктора физического мира
 * @return  {World}            Экземпляр класса физического мира
 */
const createWorld = options => {
  return new World(options);
};

export default createWorld;
