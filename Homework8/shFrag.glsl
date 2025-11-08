#version 300 es

precision highp float;

out vec4 FragColor;
in vec3 fragPos;  
in vec3 normal;  
in vec2 texCoord;

struct Material {
    sampler2D diffuse; // diffuse map
    vec3 specular;     // 표면의 specular color
    float shininess;   // specular 반짝임 정도
};

struct Light {
    //vec3 position;
    vec3 direction;
    vec3 ambient; // ambient 적용 strength
    vec3 diffuse; // diffuse 적용 strength
    vec3 specular; // specular 적용 strength
};

uniform Material material;
uniform Light light;
uniform vec3 u_viewPos;

uniform int u_toonLevels;

float quantize01(float x, int L) {
    float xf = clamp(x, 0.0, 1.0);
    float levels = float(max(L, 1));
    float k = floor(xf * levels);
    return k / levels;
}

void main() {
    // ambient
    vec3 rgb = texture(material.diffuse, texCoord).rgb;
    vec3 ambient = light.ambient * rgb;
  	
    // diffuse 
    vec3 norm = normalize(normal);
    //vec3 lightDir = normalize(light.position - fragPos);
    vec3 lightDir = normalize(light.direction);
    float dotNormLight = dot(norm, lightDir);
    float diff = max(dotNormLight, 0.0);
    
    // specular
    vec3 viewDir = normalize(u_viewPos - fragPos);
    vec3 reflectDir = reflect(-lightDir, norm);
    float spec = 0.0;
    if (dotNormLight > 0.0) {
        spec = pow(max(dot(viewDir, reflectDir), 0.0), material.shininess);
    }
    
    float qDiff = quantize01(diff, u_toonLevels);
    float qSpec = quantize01(spec, u_toonLevels);

    vec3 diffuse = light.diffuse * qDiff * rgb;  
    vec3 specular = light.specular * qSpec * material.specular;  

    vec3 result = ambient + diffuse + specular;
    FragColor = vec4(result, 1.0);
} 