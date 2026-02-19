import { SkillDefinition, SkillParameter, ToolDefinition } from './types';

/**
 * @class SkillRegistry
 * @description 스킬들을 등록하고 관리하며, LLM Tool Definition 형태로 변환하는 싱글턴 레지스트리 클래스
 */
class SkillRegistry {
  private static _instance: SkillRegistry;
  private _skills: Map<string, SkillDefinition> = new Map();

  private constructor() {
    // 싱글턴 패턴을 위해 생성자를 private으로 선언
  }

  /**
   * @method getInstance
   * @description SkillRegistry의 싱글턴 인스턴스를 반환합니다.
   * @returns {SkillRegistry} SkillRegistry의 유일한 인스턴스
   */
  public static getInstance(): SkillRegistry {
    if (!SkillRegistry._instance) {
      SkillRegistry._instance = new SkillRegistry();
    }
    return SkillRegistry._instance;
  }

  /**
   * @method register
   * @description 단일 스킬을 레지스트리에 등록합니다.
   * @param {SkillDefinition} skill - 등록할 스킬 정의
   */
  public register(skill: SkillDefinition): void {
    this._skills.set(skill.name, skill);
  }

  /**
   * @method registerAll
   * @description 여러 스킬을 레지스트리에 일괄 등록합니다.
   * @param {SkillDefinition[]} skills - 등록할 스킬 정의 배열
   */
  public registerAll(skills: SkillDefinition[]): void {
    skills.forEach(skill => this.register(skill));
  }

  /**
   * @method getSkill
   * @description 주어진 이름으로 스킬을 조회합니다.
   * @param {string} name - 조회할 스킬의 이름
   * @returns {SkillDefinition | undefined} 해당 스킬 정의 또는 undefined
   */
  public getSkill(name: string): SkillDefinition | undefined {
    return this._skills.get(name);
  }

  /**
   * @method getSkillsByModule
   * @description 주어진 모듈에 속한 모든 스킬을 조회합니다.
   * @param {string} module - 조회할 모듈의 이름
   * @returns {SkillDefinition[]} 해당 모듈에 속한 스킬 정의 배열
   */
  public getSkillsByModule(module: string): SkillDefinition[] {
    return Array.from(this._skills.values()).filter(skill => skill.module === module);
  }

  /**
   * @method getAllSkills
   * @description 레지스트리에 등록된 모든 스킬을 조회합니다.
   * @returns {SkillDefinition[]} 모든 스킬 정의 배열
   */
  public getAllSkills(): SkillDefinition[] {
    return Array.from(this._skills.values());
  }

  /**
   * @method getModules
   * @description 등록된 모든 스킬 모듈의 고유한 목록을 반환합니다.
   * @returns {string[]} 모듈 이름 문자열 배열
   */
  public getModules(): string[] {
    const modules = new Set<string>();
    this._skills.forEach(skill => modules.add(skill.module));
    return Array.from(modules);
  }

  /**
   * @method toToolDefinitions
   * @description 스킬 정의를 LLM Tool Definition JSON Schema 형태로 변환합니다.
   *              특정 모듈이 주어지면 해당 모듈과 'system' 모듈의 스킬만 포함합니다.
   *              모듈이 주어지지 않으면 모든 스킬을 포함합니다.
   * @param {string} [module] - 필터링할 모듈의 이름 (선택 사항)
   * @returns {ToolDefinition[]} LLM Tool Definition 배열
   */
  public toToolDefinitions(module?: string): ToolDefinition[] {
    let skillsToConvert: SkillDefinition[];

    if (module) {
      const targetModuleSkills = this.getSkillsByModule(module);
      const systemModuleSkills = this.getSkillsByModule('system'); // 'system' 모듈은 항상 포함
      skillsToConvert = [...targetModuleSkills, ...systemModuleSkills];
    } else {
      skillsToConvert = this.getAllSkills();
    }

    return skillsToConvert.map(skill => {
      const properties: Record<string, any> = {};
      const required: string[] = [];

      skill.parameters.forEach(param => {
        properties[param.name] = {
          type: this.mapSkillParameterTypeToJSONSchema(param.type),
          description: param.description,
        };
        if (param.type === 'date') {
          properties[param.name].format = 'date-time';
        }
        if (param.enum) {
          properties[param.name].enum = param.enum;
        }
        if (param.required) {
          required.push(param.name);
        }
      });

      return {
        name: skill.name,
        description: skill.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      };
    });
  }

  /**
   * @private
   * @method mapSkillParameterTypeToJSONSchema
   * @description SkillParameter의 타입을 JSON Schema 호환 타입으로 매핑합니다.
   * @param {'string' | 'number' | 'boolean' | 'date'} type - 스킬 파라미터 타입
   * @returns {string} JSON Schema 호환 타입 문자열
   */
  private mapSkillParameterTypeToJSONSchema(type: 'string' | 'number' | 'boolean' | 'date'): string {
    switch (type) {
      case 'date':
        return 'string'; // 'date' 타입은 JSON Schema에서 'string'으로 표현하고 format을 추가
      default:
        return type;
    }
  }
}

// SkillRegistry의 싱글턴 인스턴스를 export합니다.
export const skillRegistry = SkillRegistry.getInstance();
