for file in submodel_instances/*.json
do
  curl -X POST http://localhost:8081/submodels \
  -H "Content-Type: application/json" \
  -d @$file
done

curl -X POST http://localhost:8081/shells \
-H "Content-Type: application/json" \
-d @aas_instances/battery_module_001.json


curl -X POST http://localhost:8081/shells \
-H "Content-Type: application/json" \
-d @aas_model/battery_model_001.json